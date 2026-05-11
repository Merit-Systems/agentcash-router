import type { NextResponse } from 'next/server';
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
 * Reached when `invokeDynamic()` returns `kind: 'request'`. The handler is
 * non-streaming (regular `async (ctx) => value`) and has no `charge()`
 * callback — the wire bills exactly `tickCost` per request, committed at
 * credential-verification time by mppx's non-SSE session middleware (or by
 * the upfront x402 `upto` cap settled for `tickCost`).
 *
 * `alreadySettled` is impossible here — dynamic x402 uses `upto` (settled
 * post-handler via Permit2) and dynamic MPP uses sessions (settled
 * post-handler via withReceipt). Both are gated by builder.ts.
 *
 * Decision tree:
 *   - handler 4xx/5xx → finalize without settling (no Payment-Receipt header
 *     attached; the credential-time auto-charge on the MPP channel is honored
 *     elsewhere but the request return path stays clean).
 *   - handler 2xx → runBeforeSettle (may abort), then settleAndFinalizeRequest
 *     for `tickCost` with onSettleError (settle-failure means money in limbo).
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

  // Request-mode dynamic routes bill exactly `tickCost` per request — the wire
  // commitment is fixed by mppx's non-SSE auto-charge (or by x402 `upto`
  // settling for the cap). Builder guarantees `tickCost` is set on dynamic.
  const billedAmount = routeEntry.tickCost!;

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
