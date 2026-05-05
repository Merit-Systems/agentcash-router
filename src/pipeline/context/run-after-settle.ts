import { firePluginHook } from '../../plugin.js';
import type { HandlerPaymentContext } from '../../types.js';
import { errorMessage } from './errors.js';
import { runSettlementError } from './run-settlement-error.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Run user-supplied afterSettle hook. Errors are logged, alerted, and routed
 * through onSettlementError(phase='afterSettle'); the already-settled response
 * is unchanged.
 */
export async function runAfterSettle(
  ctx: FlowCtx,
  scope: SettleScope<HandlerPaymentContext & { status: 'settled' }>,
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.afterSettle;
  if (!hook) return;
  try {
    await hook(settlementContext(ctx, scope));
  } catch (error) {
    const message = errorMessage(error, 'Post-settlement hook failed');
    console.error(`[router] ${ctx.routeEntry.key}: afterSettle failed: ${message}`);
    firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'error' as const,
      message: `Post-settlement hook failed: ${message}`,
      route: ctx.routeEntry.key,
    });
    await runSettlementError(ctx, scope, error, 'afterSettle');
  }
}
