import type { NextResponse } from 'next/server';
import { errorMessage, errorStatus } from './errors.js';
import { fail } from './fail.js';
import { settlementContext } from './settlement-context.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Run user-supplied beforeSettle hook. Throws → fail with the thrown status.
 * Returns null on success or when no hook is configured.
 */
export async function runBeforeSettle(
  ctx: FlowCtx,
  scope: SettleScope,
): Promise<NextResponse | null> {
  const hook = ctx.routeEntry.settlement?.beforeSettle;
  if (!hook) return null;
  try {
    await hook(settlementContext(ctx, scope));
    return null;
  } catch (error) {
    return fail(
      ctx,
      errorStatus(error, 500),
      errorMessage(error, 'Pre-settlement validation failed'),
      scope.body,
    );
  }
}
