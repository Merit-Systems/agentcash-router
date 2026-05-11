import { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import type { HandlerContext, HandlerPaymentContext } from '../../../types.js';
import { HttpError } from '../../../types.js';
import { parseQuery } from '../../context/parse-query.js';
import type { FlowCtx, StaticRequestResult } from '../../context/types.js';

/**
 * Static-route handler invocation.
 *
 * Static routes have a fixed price (`billedAmount = quoted price`), so the
 * handler ctx has no `charge` callback and the result has no chargeContext.
 *
 * Static handlers are always request-shaped (never streams) — the builder
 * rejects async generator handlers at registration time when pricing is
 * static. The runtime assertion below is defense-in-depth in case a wrapped
 * handler slips past the builder check.
 *
 * `payment` is nullable so the free-route tail (`runHandlerOnly`) can share
 * this function: paid/static passes a verified `HandlerPaymentContext`, free
 * routes pass `null`.
 */
export async function invokeStatic(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext | null,
): Promise<StaticRequestResult> {
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
  };

  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error);
  }

  if (isAsyncIterable(returned) && !isThenable(returned)) {
    return errorResult(
      new HttpError(
        `route '${ctx.routeEntry.key}': streaming handlers require .paid({ dynamic: true })`,
        500,
      ),
    );
  }

  let rawResult: unknown;
  try {
    rawResult = await (returned as Promise<unknown>);
  } catch (error) {
    return errorResult(error);
  }

  const response =
    rawResult instanceof Response ? (rawResult as NextResponse) : NextResponse.json(rawResult);
  return { response, rawResult };
}

function errorResult(error: unknown): StaticRequestResult {
  const status =
    error instanceof HttpError
      ? error.status
      : typeof (error as Record<string, unknown> | null)?.status === 'number'
        ? ((error as Record<string, unknown>).status as number)
        : 500;
  const message = error instanceof Error ? error.message : 'Internal error';
  return {
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
