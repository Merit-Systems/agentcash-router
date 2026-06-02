import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { fail } from '../fail.js';
import type { FlowCtx } from '../types.js';
import { runPostSettleEpilogue } from './epilogue.js';

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
  const { request, routeEntry, deps, report } = ctx;

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
    report,
  });

  if (!settle.ok) {
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body, {
      cause: settle.error,
    });
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
