import { errorMessage, errorStatus } from './errors.js';
import { fail } from './fail.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

export type BeforeSettleOutcome =
  | { action: 'continue' }
  | { action: 'skip' }
  | { action: 'fail'; response: Response };

export async function runBeforeSettle(
  ctx: FlowCtx,
  scope: SettleScope,
): Promise<BeforeSettleOutcome> {
  const hook = ctx.routeEntry.settlement?.beforeSettle;
  if (!hook) return { action: 'continue' };
  try {
    const decision = await hook(settlementContext(ctx, scope));
    if (decision === 'skip') return { action: 'skip' };
    return { action: 'continue' };
  } catch (error) {
    return {
      action: 'fail',
      response: fail(
        ctx,
        errorStatus(error, 500),
        errorMessage(error, 'Pre-settlement validation failed'),
        scope.body,
      ),
    };
  }
}
