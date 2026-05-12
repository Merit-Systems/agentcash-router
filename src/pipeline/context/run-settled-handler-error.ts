import type { HandlerPaymentContext } from '../../types.js';
import { errorMessage, handlerFailureError } from './errors.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

export async function runSettledHandlerError(
  ctx: FlowCtx,
  scope: SettleScope<HandlerPaymentContext & { status: 'settled' }>,
  error: unknown = scope.handlerError ?? handlerFailureError(scope.response),
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.onSettledHandlerError;
  if (!hook) return;
  try {
    await hook({ ...settlementContext(ctx, scope), error });
  } catch (hookError) {
    const message = errorMessage(hookError, 'Settled handler error hook failed');
    ctx.report('error', `Settled handler error hook failed: ${message}`);
  }
}
