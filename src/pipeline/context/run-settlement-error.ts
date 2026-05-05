import { firePluginHook } from '../../plugin.js';
import { errorMessage } from './errors.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Run user-supplied onSettlementError hook. Errors thrown by the hook are
 * logged and alerted but never re-thrown — the original settlement error has
 * already been handled by the caller.
 */
export async function runSettlementError(
  ctx: FlowCtx,
  scope: SettleScope,
  error: unknown,
  phase: 'settle' | 'afterSettle',
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.onSettlementError;
  if (!hook) return;
  try {
    await hook({ ...settlementContext(ctx, scope), error, phase });
  } catch (hookError) {
    const message = errorMessage(hookError, 'Settlement error hook failed');
    console.error(`[router] ${ctx.routeEntry.key}: onSettlementError failed: ${message}`);
    firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'error' as const,
      message: `Settlement error hook failed: ${message}`,
      route: ctx.routeEntry.key,
    });
  }
}
