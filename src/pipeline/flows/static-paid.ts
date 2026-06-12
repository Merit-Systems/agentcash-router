/**
 * Exact-billing paid flow: the price is known before the handler runs.
 * Prologue (gate → challenge → verify) is shared via `resolvePaidRequest`;
 * this module owns the invoke + settle tail, including the already-settled
 * (SIWX replay / MPP tx-mode) branch.
 */
import type { PaymentStrategy, VerifySuccess } from '../../protocols/types.js';
import type { HandlerPaymentContext } from '../../types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettledHandlerError,
  runSettlementError,
  settleAndFinalizeRequest,
  type FlowCtx,
  type SettleScope,
} from '../steps/index.js';
import type { StaticRequestResult } from '../steps/types.js';
import { invokePaidStatic } from './invoke.js';
import { resolvePaidRequest } from './resolve-paid-request.js';

export async function runStaticPaidFlow(ctx: FlowCtx): Promise<Response> {
  const resolution = await resolvePaidRequest(ctx);
  if (resolution.kind === 'response') return resolution.response;
  const { account, strategy, parsedBody, price, verifyOutcome } = resolution;

  const result = await invokePaidStatic(
    ctx,
    verifyOutcome.wallet,
    account,
    parsedBody,
    verifyOutcome.payment,
  );
  return runStaticRequestFlow({
    ctx,
    strategy,
    verifyOutcome,
    account,
    body: parsedBody,
    price,
    result,
  });
}

async function runStaticRequestFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  price: string;
  result: StaticRequestResult;
}): Promise<Response> {
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
      return finalize(
        ctx,
        result.response,
        result.rawResult,
        body,
        failureFromCause(result.handlerError),
      );
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
    return finalize(
      ctx,
      result.response,
      result.rawResult,
      body,
      failureFromCause(result.handlerError),
    );
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

function failureFromCause(cause: unknown) {
  return cause === undefined ? undefined : { cause };
}
