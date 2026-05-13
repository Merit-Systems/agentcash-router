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
