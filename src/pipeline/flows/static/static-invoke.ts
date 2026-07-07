import { resolveActor } from '../../../auth/agent-identity.js';
import type { HandlerContext, HandlerPaymentContext, UptoHandlerContext } from '../../../types.js';
import { HttpError } from '../../../types.js';
import type { FlowCtx, StaticRequestResult } from '../../steps/types.js';

export async function invokePaidStatic(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<StaticRequestResult> {
  const actorResult = await resolveActorForHandler(ctx);
  if (actorResult.kind === 'error') return actorResult.result;
  return runHandler(ctx, buildHandlerCtx(ctx, wallet, account, body, payment, actorResult.actor));
}

export async function invokeUnauthed(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
): Promise<StaticRequestResult> {
  const actorResult = await resolveActorForHandler(ctx);
  if (actorResult.kind === 'error') return actorResult.result;

  const base = buildHandlerCtx(ctx, wallet, account, body, null, actorResult.actor);
  if (ctx.routeEntry.billing !== 'upto') return runHandler(ctx, base);
  const uptoCtx: UptoHandlerContext = { ...base, charge: async () => {} };
  return runHandler(ctx, uptoCtx);
}

async function resolveActorForHandler(
  ctx: FlowCtx,
): Promise<{ kind: 'ok'; actor: string | null } | { kind: 'error'; result: StaticRequestResult }> {
  try {
    const actor = await resolveActor(ctx.request, ctx.deps.agentIdentityNonceStore);
    return { kind: 'ok', actor };
  } catch (error) {
    return { kind: 'error', result: errorResult(error) };
  }
}

function buildHandlerCtx(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext | null,
  actor: string | null,
): HandlerContext {
  return {
    body: body as never,
    query: ctx.query as never,
    params: ctx.params,
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

async function runHandler(ctx: FlowCtx, handlerCtx: HandlerContext): Promise<StaticRequestResult> {
  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error);
  }

  if (isAsyncIterable(returned) && !isThenable(returned)) {
    return errorResult(
      new HttpError(`route '${ctx.routeEntry.key}': streaming handlers require .session()`, 500),
    );
  }

  let rawResult: unknown;
  try {
    rawResult = await (returned as Promise<unknown>);
  } catch (error) {
    return errorResult(error);
  }

  const response = rawResult instanceof Response ? rawResult : Response.json(rawResult);
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
    response: Response.json(responseBody, { status }),
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
