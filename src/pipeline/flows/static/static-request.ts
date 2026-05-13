import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import type { HandlerPaymentContext } from '../../../types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettledHandlerError,
  runSettlementError,
  settleAndFinalizeRequest,
} from '../../steps/index.js';
import type { FlowCtx, SettleScope, StaticRequestResult } from '../../steps/types.js';

export async function runStaticRequestFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  price: string;
  result: StaticRequestResult;
}): Promise<NextResponse> {
  const { ctx, strategy, verifyOutcome, account, body, price, result } = args;

  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body,
    payment: verifyOutcome.payment,
    response: result.response,
    rawResult: result.rawResult,
    handlerError: result.handlerError,
  };

  if (verifyOutcome.alreadySettled) {
    if (result.response.status >= 400) {
      const settledScope = settleScope as SettleScope<
        HandlerPaymentContext & { status: 'settled' }
      >;
      await runSettledHandlerError(ctx, settledScope);
      return finalize(ctx, result.response, result.rawResult, body);
    }
    return settleAndFinalizeRequest({
      ctx,
      strategy,
      verifyOutcome,
      scope: settleScope,
      rawResult: result.rawResult,
      body,
      billedAmount: price,
    });
  }

  if (result.response.status >= 400) {
    return finalize(ctx, result.response, result.rawResult, body);
  }

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

  return settleAndFinalizeRequest({
    ctx,
    strategy,
    verifyOutcome,
    scope: settleScope,
    rawResult: result.rawResult,
    body,
    billedAmount: price,
    onSettleError: async (error, failMessage) => {
      await runSettlementError(ctx, settleScope, error, 'settle');
      ctx.report(
        'critical',
        `${strategy.protocol} ${failMessage}: ${errorMessage(error, 'unknown')}`,
      );
    },
  });
}
