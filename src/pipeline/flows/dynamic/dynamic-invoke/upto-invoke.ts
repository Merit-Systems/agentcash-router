import { createUptoChargeContext } from '../../../../pricing/upto-charge.js';
import type { HandlerPaymentContext, UptoHandlerContext } from '../../../../types.js';
import { HttpError } from '../../../../types.js';
import type { DynamicRequestResult, FlowCtx } from '../../../steps/types.js';
import {
  buildBaseHandlerCtx,
  errorResult,
  isAsyncIterable,
  isThenable,
  resolveActorOrError,
  toResponse,
} from './shared.js';

/** `.upTo()` invocation: handler accumulates billing via `charge(amount)`; settles once for the total. */
export async function invokeUpto(
  ctx: FlowCtx,
  wallet: string,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext,
): Promise<DynamicRequestResult> {
  const actorResult = await resolveActorOrError(ctx);
  if ('response' in actorResult) return actorResult;

  const uptoCtx = createUptoChargeContext({
    maxPrice: ctx.routeEntry.maxPrice!,
    route: ctx.routeEntry.key,
  });

  const handlerCtx: UptoHandlerContext = {
    ...buildBaseHandlerCtx(ctx, wallet, account, body, payment, actorResult.actor),
    charge: uptoCtx.charge,
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
        'streaming is not supported on .upTo() routes — return a value from .handler() instead',
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

  return { kind: 'request', response: toResponse(rawResult), rawResult, uptoContext: uptoCtx };
}
