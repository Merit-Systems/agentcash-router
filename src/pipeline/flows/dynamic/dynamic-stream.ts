import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { settleAndFinalizeStream } from '../../context/index.js';
import type { DynamicStreamResult, FlowCtx } from '../../context/types.js';

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
