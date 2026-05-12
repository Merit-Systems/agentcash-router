import { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import { createChargeContext, type ChargeContext } from '../../../pricing/charge-context.js';
import type {
  HandlerContext,
  HandlerPaymentContext,
  StreamingHandlerContext,
} from '../../../types.js';
import { HttpError } from '../../../types.js';
import { parseQuery } from '../../context/parse-query.js';
import type { DynamicInvokeResult, FlowCtx } from '../../context/types.js';

export async function invokeDynamic(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<DynamicInvokeResult> {
  const streaming = ctx.routeEntry.streaming === true;
  const chargeContext: ChargeContext | null = streaming
    ? createChargeContext({
        tickCost: ctx.routeEntry.tickCost!,
        maxPrice: ctx.routeEntry.maxPrice,
        route: ctx.routeEntry.key,
      })
    : null;

  const baseHandlerCtx: HandlerContext = {
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

  const handlerCtx: HandlerContext | StreamingHandlerContext =
    chargeContext !== null
      ? ({ ...baseHandlerCtx, charge: chargeContext.charge } as StreamingHandlerContext)
      : baseHandlerCtx;

  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error, chargeContext);
  }
  if (isAsyncIterable(returned) && !isThenable(returned)) {
    if (!chargeContext) {
      return errorResult(
        new HttpError(
          'route returned an async iterable from a non-streaming handler — declare with `async function*` to opt into streaming',
          500,
        ),
        null,
      );
    }
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
  return { kind: 'request', response, rawResult };
}

function errorResult(error: unknown, chargeContext: ChargeContext | null): DynamicInvokeResult {
  const status =
    error instanceof HttpError
      ? error.status
      : typeof (error as Record<string, unknown> | null)?.status === 'number'
        ? ((error as Record<string, unknown>).status as number)
        : 500;
  const message = error instanceof Error ? error.message : 'Internal error';
  void chargeContext;
  return {
    kind: 'request',
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
