import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { settleAndFinalizeStream } from '../../steps/index.js';
import type { DynamicStreamResult, FlowCtx } from '../../steps/types.js';

export async function runDynamicStreamFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  result: DynamicStreamResult;
}): Promise<Response> {
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
