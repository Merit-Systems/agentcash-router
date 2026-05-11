import type { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import type { HandlerPaymentContext } from '../../../types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettledHandlerError,
  runSettlementError,
  settleAndFinalizeRequest,
} from '../../context/index.js';
import type { FlowCtx, SettleScope, StaticRequestResult } from '../../context/types.js';

/**
 * Static request lifecycle.
 *
 * The handler returned a value/Response synchronously (static routes can't
 * stream — the builder rejects async-generator handlers at registration).
 * Pricing is fixed — `billedAmount` equals the quoted `price`; there is no
 * chargeContext.
 *
 * Static routes can have payment already settled at verify time (MPP hash —
 * money is already on chain). Decision tree:
 *
 *   - alreadySettled (MPP hash):
 *       - 4xx → runSettledHandlerError, finalize (money already moved on-chain;
 *         the user hook decides whether to enqueue refund/compensation)
 *       - 2xx → settleAndFinalizeRequest (no onSettleError; settle failure
 *         here is a credential-refresh problem, not a money-loss problem)
 *   - verified-but-not-settled (x402 exact, MPP transaction):
 *       - 4xx → finalize, no settle (no money moves on handler error)
 *       - 2xx → runBeforeSettle (may abort), then settleAndFinalizeRequest
 *               with onSettleError (settle-failure means money in limbo).
 */
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
  const { deps, routeEntry } = ctx;

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
      firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
        level: 'critical' as const,
        message: `${strategy.protocol} ${failMessage}: ${errorMessage(error, 'unknown')}`,
        route: routeEntry.key,
      });
    },
  });
}
