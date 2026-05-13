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

export async function runDynamicChannelMgmtFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  account: unknown;
  pricing: PricingStrategy | null;
  skipBody: boolean;
}): Promise<NextResponse> {
  const { ctx, strategy, account, pricing, skipBody } = args;
  const { request, routeEntry, deps, report } = ctx;

  const bodyAndPrice = await resolveDynamicBodyAndPrice({ ctx, pricing, skipBody });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verifyOutcome = await strategy.verify({
    request,
    body: parsedBody,
    price,
    routeEntry,
    deps,
    report,
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
      report('critical', `${strategy.protocol} ${failMessage}: ${errorMessage(error, 'unknown')}`);
    },
  });
}
