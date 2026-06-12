/**
 * Handler-charged paid flows (`.upTo()` / `.metered()`): the handler
 * accumulates the billed amount, so invoke happens before the price is
 * final. Prologue is shared via `resolvePaidRequest`; this module owns the
 * upto/metered invoke dispatch plus the request and stream settle tails.
 */
import type { PaymentStrategy, VerifySuccess } from '../../protocols/types.js';
import { atomicToDecimal } from '../../pricing/format.js';
import { HttpError, type RouteEntry } from '../../types.js';
import {
  errorMessage,
  finalize,
  runBeforeSettle,
  runSettlementError,
  settleAndFinalizeRequest,
  settleAndFinalizeStream,
  type FlowCtx,
  type SettleScope,
} from '../steps/index.js';
import type {
  DynamicInvokeResult,
  DynamicRequestResult,
  DynamicStreamResult,
} from '../steps/types.js';
import { invokeMetered, invokeUpto } from './dynamic-invoke/index.js';
import { resolvePaidRequest } from './resolve-paid-request.js';

export async function runDynamicPaidFlow(ctx: FlowCtx): Promise<Response> {
  const resolution = await resolvePaidRequest(ctx);
  if (resolution.kind === 'response') return resolution.response;
  const { account, strategy, parsedBody, verifyOutcome } = resolution;

  const result = await invokeDynamic(ctx, verifyOutcome, account, parsedBody);

  switch (result.kind) {
    case 'stream':
      return runDynamicStreamFlow({
        ctx,
        strategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
    case 'request':
      return runDynamicRequestFlow({
        ctx,
        strategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
  }
}

async function invokeDynamic(
  ctx: FlowCtx,
  verifyOutcome: VerifySuccess,
  account: unknown,
  parsedBody: unknown,
): Promise<DynamicInvokeResult> {
  switch (ctx.routeEntry.billing) {
    case 'upto':
      return invokeUpto(ctx, verifyOutcome.wallet, account, parsedBody, verifyOutcome.payment);
    case 'metered':
      return invokeMetered(ctx, verifyOutcome.wallet, account, parsedBody, verifyOutcome.payment);
    case 'exact':
      throw new Error(
        `route '${ctx.routeEntry.key}': exact billing must not reach the dynamic paid flow`,
      );
  }
}

async function runDynamicRequestFlow(args: {
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
      result.handlerError === undefined ? undefined : { cause: result.handlerError },
    );
  }

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

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

async function runDynamicStreamFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  account: unknown;
  body: unknown;
  result: DynamicStreamResult;
}): Promise<Response> {
  const { ctx, strategy, verifyOutcome, account, body, result } = args;

  return settleAndFinalizeStream({
    ctx,
    strategy,
    verifyOutcome,
    source: result.source,
    account,
    body,
    bindChannelCharge: result.chargeContext.bindChannelCharge,
  });
}
