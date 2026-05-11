import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { settleAndFinalizeStream } from '../../context/index.js';
import type { DynamicStreamResult, FlowCtx } from '../../context/types.js';

/**
 * Dynamic + streaming-handler lifecycle.
 *
 * Reached when `invokeDynamic()` returns `kind: 'stream'`. Streams are only
 * valid on dynamic routes — `chargeContext.bindChannelCharge` bridges
 * `charge()` calls to per-tick MPP session voucher debits. The dispatcher
 * rejects stream-on-static before calling here.
 *
 * The iterable hasn't been consumed yet; mppx's `Sse.serve` iterates it on
 * the wire after this function returns the SSE Response.
 *
 * `runBeforeSettle`, `onSettleError`, and the `alreadySettled` branch don't
 * apply:
 *   - the handler hasn't produced output to inspect before settle commits,
 *   - per-tick voucher debits replace the single-shot settle call (no limbo),
 *   - sessions are never `alreadySettled` at verify time.
 */
export async function runDynamicStreamFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  result: DynamicStreamResult;
}): Promise<NextResponse> {
  const { ctx, strategy, verifyOutcome, account, body, result } = args;

  return settleAndFinalizeStream({
    ctx,
    strategy,
    verifyOutcome,
    source: result.source,
    account,
    body,
    bindChannelCharge: result.chargeContext.bindChannelCharge,
  });
}
