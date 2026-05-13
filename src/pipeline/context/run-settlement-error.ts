import { errorMessage } from './errors.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

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
    ctx.report('error', `Settlement error hook failed: ${message}`);
  }
}
