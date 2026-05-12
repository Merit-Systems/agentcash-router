import { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import type { PricingStrategy } from '../../../pricing/index.js';
import type { PaymentStrategy } from '../../../protocols/types.js';
import {
  errorMessage,
  fail,
  runBeforeSettle,
  runSettlementError,
  settleAndFinalizeRequest,
  type FlowCtx,
  type SettleScope,
} from '../../context/index.js';
import { build402 } from '../build402.js';
import { resolveDynamicBodyAndPrice } from './dynamic-body-and-price.js';

/**
 * MPP channel-management lifecycle (close, topUp, bodyless open|voucher).
 *
 * Reached when `strategy.preflight()` flags `skipHandler: true`. No handler
 * runs and no body is parsed; the strategy's `settle()` emits a channel-state
 * ack via mppx's `withReceipt`. `billedAmount` is "0" — these credentials
 * advance the channel nonce but don't bill content.
 *
 * Channel-mgmt is dynamic-only — static-priced MPP routes don't advertise
 * sessions and `verify` rejects session credentials on static routes.
 *
 * `runBeforeSettle` and `onSettleError` still fire so route hooks see the
 * channel-management traffic and any settle failure escalates the same way as
 * a content request.
 */
export async function runDynamicChannelMgmtFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  account: unknown;
  pricing: PricingStrategy | null;
  skipBody: boolean;
}): Promise<NextResponse> {
  const { ctx, strategy, account, pricing, skipBody } = args;
  const { request, routeEntry, deps } = ctx;

  const bodyAndPrice = await resolveDynamicBodyAndPrice({ ctx, pricing, skipBody });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verifyOutcome = await strategy.verify({
    request,
    body: parsedBody,
    price,
    routeEntry,
    deps,
  });

  if (verifyOutcome.ok === false) {
    if (verifyOutcome.kind === 'config') {
      return fail(ctx, 500, verifyOutcome.message, parsedBody);
    }
    return build402(ctx, pricing, parsedBody, verifyOutcome.failure);
  }

  ctx.pluginCtx.setVerifiedWallet(verifyOutcome.wallet);
  firePluginHook(deps.plugin, 'onPaymentVerified', ctx.pluginCtx, {
    protocol: strategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  const synthetic = new NextResponse(null, { status: 200 });
  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body: parsedBody,
    payment: verifyOutcome.payment,
    response: synthetic,
    rawResult: undefined,
  };

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

  return settleAndFinalizeRequest({
    ctx,
    strategy,
    verifyOutcome,
    scope: settleScope,
    rawResult: undefined,
    body: parsedBody,
    billedAmount: '0',
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
