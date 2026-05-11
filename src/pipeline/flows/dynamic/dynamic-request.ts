import type { NextResponse } from 'next/server';
import { atomicToDecimal } from '../../../pricing/atomic.js';
import { firePluginHook } from '../../../plugin.js';
import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettlementError,
  settleAndFinalizeRequest,
} from '../../context/index.js';
import type { DynamicRequestResult, FlowCtx, SettleScope } from '../../context/types.js';

/**
 * Dynamic request lifecycle.
 *
 * Reached when `invokeDynamic()` returns `kind: 'request'`. The handler
 * returned a value/Response synchronously and may have called `charge()` to
 * accumulate the bill in `chargeContext`.
 *
 * `alreadySettled` is impossible here — dynamic x402 uses `upto` (settled
 * post-handler via Permit2) and dynamic MPP uses sessions (also settled
 * post-handler via withReceipt). Both are gated by builder.ts.
 *
 * Decision tree:
 *   - chargeContext.atomicTotal() == 0n → handler chose not to bill;
 *     finalize without settling (free request).
 *   - handler 4xx/5xx → finalize without settling (no money moves on error).
 *   - handler 2xx → runBeforeSettle (may abort), then settleAndFinalizeRequest
 *     with onSettleError (settle-failure means money in limbo).
 */
export async function runDynamicRequestFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  result: DynamicRequestResult;
}): Promise<NextResponse> {
  const { ctx, strategy, verifyOutcome, account, body, result } = args;
  const { deps, routeEntry } = ctx;
  const { chargeContext } = result;

  if (chargeContext.atomicTotal() === 0n) {
    return finalize(ctx, result.response, result.rawResult, body);
  }

  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body,
    payment: verifyOutcome.payment,
    response: result.response,
    rawResult: result.rawResult,
    handlerError: result.handlerError,
  };

  if (result.response.status >= 400) {
    return finalize(ctx, result.response, result.rawResult, body);
  }

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

  const billedAmount = atomicToDecimal(chargeContext.atomicTotal());

  return settleAndFinalizeRequest({
    ctx,
    strategy,
    verifyOutcome,
    scope: settleScope,
    rawResult: result.rawResult,
    body,
    billedAmount,
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
