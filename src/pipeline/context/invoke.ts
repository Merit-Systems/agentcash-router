import { NextResponse } from 'next/server';
import type { ChargeFn, HandlerContext, HandlerPaymentContext } from '../../types.js';
import { HttpError } from '../../types.js';
import { firePluginHook } from '../../plugin.js';
import { parseQuery } from './parse-query.js';
import type { FlowCtx, InvokeResult } from './types.js';

/**
 * Build the handler's context and call it, then dispatch on what came back:
 *
 *   - sync throw / rejected promise → batch error response
 *   - returned Response             → batch (passed through verbatim)
 *   - returned value                → batch (wrapped via NextResponse.json)
 *   - returned AsyncIterable        → stream (passed through to settleStream)
 *
 * The handler shape isn't known until we actually call it — `async (ctx) => x`
 * returns `Promise<x>`, but `async function* (ctx)` returns the async generator
 * synchronously without producing a Promise.
 */
export async function invoke(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext | null,
  charge?: ChargeFn,
): Promise<InvokeResult> {
  const handlerCtx: HandlerContext = {
    body: body as never,
    query: parseQuery(ctx.request, ctx.routeEntry) as never,
    request: ctx.request,
    requestId: ctx.meta.requestId,
    route: ctx.routeEntry.key,
    wallet,
    payment,
    account,
    alert(level, message, alertMeta) {
      firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
        level,
        message,
        route: ctx.routeEntry.key,
        meta: alertMeta,
      });
    },
    setVerifiedWallet: (addr) => ctx.pluginCtx.setVerifiedWallet(addr),
    ...(charge ? { charge } : {}),
  };

  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error);
  }

  // Async generators return their iterable synchronously, before any yield runs.
  // A regular `async (ctx) => x` returns a Promise, which we await as batch.
  if (isAsyncIterable(returned) && !isThenable(returned)) {
    return { kind: 'stream', source: returned as AsyncIterable<unknown> };
  }

  let rawResult: unknown;
  try {
    rawResult = await (returned as Promise<unknown>);
  } catch (error) {
    return errorResult(error);
  }

  const response =
    rawResult instanceof Response ? (rawResult as NextResponse) : NextResponse.json(rawResult);
  return { kind: 'batch', response, rawResult };
}

function errorResult(error: unknown): InvokeResult {
  // Match safeCallHandler's tolerance: HttpError or any object with a
  // numeric `.status` field. Default to 500.
  const status =
    error instanceof HttpError
      ? error.status
      : typeof (error as Record<string, unknown> | null)?.status === 'number'
        ? ((error as Record<string, unknown>).status as number)
        : 500;
  const message = error instanceof Error ? error.message : 'Internal error';
  return {
    kind: 'batch',
    response: NextResponse.json({ success: false, error: message }, { status }),
    rawResult: undefined,
    handlerError: error,
  };
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value != null && typeof value === 'object' && Symbol.asyncIterator in (value as object);
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
