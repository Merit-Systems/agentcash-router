import type { NextResponse } from 'next/server';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { fail } from '../fail.js';
import type { FlowCtx, SettleScope } from '../types.js';
import { runPostSettleEpilogue } from './epilogue.js';

/**
 * Runs `strategy.settle()` for batch (non-streaming) responses and the shared
 * post-settle epilogue. Used by every batch settle path: x402 static and
 * dynamic (`upto`), MPP transaction-payload, MPP hash-payload, and MPP
 * session-payload non-streaming.
 *
 * Pass `onSettleError` from verified-but-not-settled callers; settle failure
 * there leaves money in limbo and warrants onSettlementError + a critical
 * alert. AlreadySettled callers omit it — settle failure is a credential
 * refresh problem and the path just bails.
 */
export async function settleAndFinalizeRequest(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  scope: SettleScope;
  rawResult: unknown;
  body: unknown;
  billedAmount: string;
  onSettleError?: (error: unknown, failMessage: string) => Promise<void>;
}): Promise<NextResponse> {
  const {
    ctx,
    strategy,
    verifyOutcome,
    scope,
    rawResult,
    body,
    billedAmount,
    onSettleError,
  } = args;
  const { request, routeEntry, deps } = ctx;

  const settle = await strategy.settle({
    request,
    response: scope.response,
    payment: verifyOutcome.payment,
    token: verifyOutcome.token,
    routeEntry,
    deps,
    billedAmount,
  });

  if (!settle.ok) {
    if (onSettleError) await onSettleError(settle.error, settle.failMessage);
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body);
  }

  return runPostSettleEpilogue({
    ctx,
    strategy,
    wallet: verifyOutcome.wallet,
    settle,
    afterSettleScope: {
      ...scope,
      payment: settle.settledPayment,
      response: settle.response,
    },
    rawResult,
    body,
  });
}
