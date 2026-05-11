import { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import { createChargeContext } from '../../../pricing/charge-context.js';
import type { HandlerContext, HandlerPaymentContext } from '../../../types.js';
import { HttpError } from '../../../types.js';
import { parseQuery } from '../../context/parse-query.js';
import type { DynamicInvokeResult, FlowCtx } from '../../context/types.js';

/**
 * Dynamic-route handler invocation.
 *
 * Mints a per-request `chargeContext` and exposes `charge()` to the handler.
 * Classifies the handler's return value into request (single response) or
 * stream (async iterable) — both variants carry the same non-null
 * `chargeContext`, so downstream lifecycles never null-check it:
 *   - request → `atomicTotal()` for `billedAmount`
 *   - stream  → `bindChannelCharge` to thread per-tick debits through mppx
 *
 * `routeEntry.dynamicPrice` is true at this point (builder.ts guarantees
 * `tickCost` is set when dynamic). The dispatcher gates on `dynamicPrice`
 * before calling here.
 */
export async function invokeDynamic(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<DynamicInvokeResult> {
  const chargeContext = createChargeContext({
    tickCost: ctx.routeEntry.tickCost!,
    maxPrice: ctx.routeEntry.maxPrice,
    route: ctx.routeEntry.key,
  });

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
    charge: chargeContext.charge,
  };

  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error, chargeContext);
  }

  // Async generators return their iterable synchronously, before any yield runs.
  // A regular `async (ctx) => x` returns a Promise, which we await as request.
  if (isAsyncIterable(returned) && !isThenable(returned)) {
    return {
      kind: 'stream',
      source: returned as AsyncIterable<unknown>,
      chargeContext,
    };
  }

  let rawResult: unknown;
  try {
    rawResult = await (returned as Promise<unknown>);
  } catch (error) {
    return errorResult(error, chargeContext);
  }

  const response =
    rawResult instanceof Response ? (rawResult as NextResponse) : NextResponse.json(rawResult);
  return { kind: 'request', response, rawResult, chargeContext };
}

function errorResult(
  error: unknown,
  chargeContext: ReturnType<typeof createChargeContext>,
): DynamicInvokeResult {
  const status =
    error instanceof HttpError
      ? error.status
      : typeof (error as Record<string, unknown> | null)?.status === 'number'
        ? ((error as Record<string, unknown>).status as number)
        : 500;
  const message = error instanceof Error ? error.message : 'Internal error';
  return {
    kind: 'request',
    response: NextResponse.json({ success: false, error: message }, { status }),
    rawResult: undefined,
    handlerError: error,
    chargeContext,
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
