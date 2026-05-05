import type { NextResponse } from 'next/server';
import { firePluginHook } from '../../plugin.js';
import type { PaymentStrategy, VerifySuccess } from '../../protocols/types.js';
import { fail } from './fail.js';
import { finalize } from './finalize.js';
import { grantEntitlementIfSiwx } from './grant-entitlement.js';
import { runAfterSettle } from './run-after-settle.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Run the strategy's settle() and the post-settle epilogue (entitlement grant,
 * onPaymentSettled hook, afterSettle hook, finalize). Both the alreadySettled
 * branch (MPP hash-payload) and the verified-but-not-settled branch (x402,
 * mpp-tx) of the paid flow run this same sequence.
 *
 * The two branches differ only in their handling of a settle failure: the
 * verified-but-not-settled path runs onSettlementError + a critical alert
 * because money is in limbo, while the alreadySettled path treats settle
 * failure as a credential refresh problem and just bails. Pass `onSettleError`
 * to opt into the louder behavior.
 */
export async function settleAndFinalize(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  scope: SettleScope;
  rawResult: unknown;
  body: unknown;
  onSettleError?: (error: unknown, failMessage: string) => Promise<void>;
}): Promise<NextResponse> {
  const { ctx, strategy, verifyOutcome, scope, rawResult, body, onSettleError } = args;
  const { request, routeEntry, deps } = ctx;

  const settle = await strategy.settle({
    request,
    response: scope.response,
    payment: verifyOutcome.payment,
    token: verifyOutcome.token,
    routeEntry,
    deps,
  });

  if (!settle.ok) {
    if (onSettleError) await onSettleError(settle.error, settle.failMessage);
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body);
  }

  await grantEntitlementIfSiwx(ctx, verifyOutcome.wallet);
  firePluginHook(deps.plugin, 'onPaymentSettled', ctx.pluginCtx, {
    protocol: strategy.protocol,
    payer: verifyOutcome.wallet,
    transaction: settle.settledPayment.transaction ?? '',
    network: settle.settledPayment.network,
  });

  await runAfterSettle(ctx, {
    ...scope,
    payment: settle.settledPayment,
    response: settle.response,
  });
  return finalize(ctx, settle.response, rawResult, body);
}
