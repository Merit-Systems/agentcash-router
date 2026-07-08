import type { PaymentStrategy, VerifySuccess } from '../../../protocols/types.js';
import { atomicToDecimal } from '../../../pricing/format.js';
import { HttpError, type RouteEntry } from '../../../types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettlementError,
  settleAndFinalizeRequest,
} from '../../steps/index.js';
import type { DynamicRequestResult, FlowCtx, SettleScope } from '../../steps/types.js';

export async function runDynamicRequestFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  result: DynamicRequestResult;
}): Promise<Response> {
  const { ctx, strategy, verifyOutcome, account, body, result } = args;
  const { routeEntry } = ctx;

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
    return finalize(
      ctx,
      result.response,
      result.rawResult,
      body,
      failureFromCause(result.handlerError),
    );
  }

  const outcome = await runBeforeSettle(ctx, settleScope);
  if (outcome.action === 'fail') return outcome.response;
  if (outcome.action === 'skip') return finalize(ctx, result.response, result.rawResult, body);

  const billedAmount = computeBilledAmount(routeEntry, result);

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

function computeBilledAmount(routeEntry: RouteEntry, result: DynamicRequestResult): string {
  if (routeEntry.billing === 'upto') {
    const total = result.uptoContext?.atomicTotal() ?? 0n;
    if (total <= 0n) {
      throw new HttpError(
        `route '${routeEntry.key}': handler did not call charge(amount) — upto routes must accumulate a non-zero billed amount`,
        500,
      );
    }
    return atomicToDecimal(total);
  }
  return routeEntry.tickCost!;
}
