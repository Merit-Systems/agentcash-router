import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { fail } from '../fail.js';
import type { FlowCtx } from '../types.js';
import { runPostSettleEpilogue } from './epilogue.js';

/**
 * Runs `strategy.settleStream()` for streaming responses and the same
 * post-settle epilogue as the request path. The settled amount carries the
 * cap or last-known total — cumulative voucher debits aren't finalized until
 * the channel closes, but `afterSettle` and `onPaymentSettled` fire at
 * stream-start so app-owned ledgers can record the request.
 */
export async function settleAndFinalizeStream(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  source: AsyncIterable<unknown>;
  account: unknown;
  body: unknown;
  bindChannelCharge: (fn: (() => Promise<void>) | null) => void;
}): Promise<NextResponse> {
  const { ctx, strategy, verifyOutcome, source, account, body, bindChannelCharge } = args;
  const { request, routeEntry, deps } = ctx;

  if (!strategy.settleStream) {
    return fail(ctx, 500, `${strategy.protocol} does not support streaming handlers`, body);
  }

  const settle = await strategy.settleStream({
    request,
    source,
    payment: verifyOutcome.payment,
    token: verifyOutcome.token,
    routeEntry,
    deps,
    bindChannelCharge,
  });

  if (!settle.ok) {
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body);
  }

  return runPostSettleEpilogue({
    ctx,
    strategy,
    wallet: verifyOutcome.wallet,
    settle,
    afterSettleScope: {
      wallet: verifyOutcome.wallet,
      account,
      body,
      payment: settle.settledPayment,
      response: settle.response,
      rawResult: undefined,
    },
    rawResult: undefined,
    body,
  });
}
