import { NextResponse } from 'next/server';
import type { HandlerContext, HandlerPaymentContext, UptoHandlerContext } from '../../../types.js';
import { HttpError } from '../../../types.js';
import type { FlowCtx, StaticRequestResult } from '../../steps/types.js';

export function invokePaidStatic(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<StaticRequestResult> {
  return runHandler(ctx, buildHandlerCtx(ctx, wallet, account, body, payment));
}

export function invokeUnauthed(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
): Promise<StaticRequestResult> {
  const base = buildHandlerCtx(ctx, wallet, account, body, null);
  if (ctx.routeEntry.billing !== 'upto') return runHandler(ctx, base);
  const uptoCtx: UptoHandlerContext = { ...base, charge: async () => {} };
  return runHandler(ctx, uptoCtx);
}

function buildHandlerCtx(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext | null,
): HandlerContext {
  return {
    body: body as never,
    query: ctx.query as never,
    request: ctx.request,
    requestId: ctx.meta.requestId,
    route: ctx.routeEntry.key,
    wallet,
    payment,
    account,
    alert: ctx.report,
    setVerifiedWallet: (addr) => ctx.pluginCtx.setVerifiedWallet(addr),
  };
}

async function runHandler(ctx: FlowCtx, handlerCtx: HandlerContext): Promise<StaticRequestResult> {
  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error);
  }

  if (isAsyncIterable(returned) && !isThenable(returned)) {
    return errorResult(
      new HttpError(`route '${ctx.routeEntry.key}': streaming handlers require .metered()`, 500),
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
  const responseBody = { success: false, error: message };
  return {
    response: NextResponse.json(responseBody, { status }),
    rawResult: responseBody,
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
