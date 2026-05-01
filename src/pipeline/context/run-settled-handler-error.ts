import { firePluginHook } from '../../plugin.js';
import type { HandlerPaymentContext } from '../../types.js';
import { errorMessage, handlerFailureError } from './errors.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Run user-supplied onSettledHandlerError hook — fires when payment is already
 * settled (e.g. MPP hash-payload) but the handler returned a 4xx/5xx. Used by
 * apps to enqueue refund/compensation work.
 */
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
    console.error(`[router] ${ctx.routeEntry.key}: onSettledHandlerError failed: ${message}`);
    firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'error' as const,
      message: `Settled handler error hook failed: ${message}`,
      route: ctx.routeEntry.key,
    });
  }
}
