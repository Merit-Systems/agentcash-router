import { NextResponse } from 'next/server';
import { resolveActor } from '../../../../auth/agent-identity.js';
import type { HandlerContext, HandlerPaymentContext } from '../../../../types.js';
import { HttpError } from '../../../../types.js';
import type { DynamicRequestResult, FlowCtx } from '../../../steps/types.js';

export function buildBaseHandlerCtx(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
  actor: string | null = null,
): HandlerContext {
  return {
    body: body as never,
    query: ctx.query as never,
    request: ctx.request,
    requestId: ctx.meta.requestId,
    route: ctx.routeEntry.key,
    wallet,
    actor,
    payment,
    account,
    alert: ctx.report,
    setVerifiedWallet: (addr) => ctx.pluginCtx.setVerifiedWallet(addr),
  };
}

export async function resolveActorOrError(
  ctx: FlowCtx,
): Promise<{ actor: string | null } | DynamicRequestResult> {
  try {
    const actor = await resolveActor(ctx.request, ctx.deps.agentIdentityNonceStore);
    return { actor };
  } catch (error) {
    return errorResult(error);
  }
}

export function toResponse(rawResult: unknown): NextResponse {
  return rawResult instanceof Response ? (rawResult as NextResponse) : NextResponse.json(rawResult);
}

export function errorResult(error: unknown): DynamicRequestResult {
  const status =
    error instanceof HttpError
      ? error.status
      : typeof (error as Record<string, unknown> | null)?.status === 'number'
        ? ((error as Record<string, unknown>).status as number)
        : 500;
  const message = error instanceof Error ? error.message : 'Internal error';
  const responseBody = { success: false, error: message };
  return {
    kind: 'request',
    response: NextResponse.json(responseBody, { status }),
    rawResult: responseBody,
    handlerError: error,
  };
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value != null && typeof value === 'object' && Symbol.asyncIterator in (value as object);
}

export function isThenable(value: unknown): value is Promise<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
