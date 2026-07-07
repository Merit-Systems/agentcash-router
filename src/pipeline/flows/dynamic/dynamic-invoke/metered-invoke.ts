import { createChargeContext } from '../../../../pricing/metered-charge.js';
import type {
  HandlerContext,
  HandlerPaymentContext,
  StreamingHandlerContext,
} from '../../../../types.js';
import { HttpError } from '../../../../types.js';
import type { DynamicInvokeResult, FlowCtx } from '../../../steps/types.js';
import {
  buildBaseHandlerCtx,
  errorResult,
  isAsyncIterable,
  isThenable,
  resolveActorOrError,
  toResponse,
} from './shared.js';

/** `.session()` invocation: `.handler()` bills exactly the per-unit cost; `.stream()` charges per yield. */
export async function invokeMetered(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<DynamicInvokeResult> {
  const actorResult = await resolveActorOrError(ctx);
  if ('response' in actorResult) return actorResult;

  const chargeContext = ctx.routeEntry.streaming
    ? createChargeContext({
        tickCost: ctx.routeEntry.tickCost!,
        maxPrice: ctx.routeEntry.maxPrice,
        route: ctx.routeEntry.key,
      })
    : null;

  const baseHandlerCtx = buildBaseHandlerCtx(
    ctx,
    wallet,
    account,
    body,
    payment,
    actorResult.actor,
  );
  const handlerCtx: HandlerContext | StreamingHandlerContext =
    chargeContext !== null
      ? ({ ...baseHandlerCtx, charge: chargeContext.charge } as StreamingHandlerContext)
      : baseHandlerCtx;

  let returned: unknown;
  try {
    returned = ctx.handler(handlerCtx);
  } catch (error) {
    return errorResult(error);
  }

  if (isAsyncIterable(returned) && !isThenable(returned)) {
    if (!chargeContext) {
      return errorResult(
        new HttpError(
          'route returned an async iterable from a non-streaming handler — use .stream(async function*(...)) instead of .handler() to opt into streaming',
          500,
        ),
      );
    }
    return { kind: 'stream', source: returned as AsyncIterable<unknown>, chargeContext };
  }

  let rawResult: unknown;
  try {
    rawResult = await (returned as Promise<unknown>);
  } catch (error) {
    return errorResult(error);
  }

  return { kind: 'request', response: toResponse(rawResult), rawResult };
}
