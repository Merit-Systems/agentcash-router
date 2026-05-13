import type { HandlerPaymentContext } from '../../types.js';
import { errorMessage } from './errors.js';
import { runSettlementError } from './run-settlement-error.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

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
    ctx.report('error', `Post-settlement hook failed: ${message}`);
    await runSettlementError(ctx, scope, error, 'afterSettle');
  }
}
