import type { NextResponse } from 'next/server';
import { selectPricing } from '../../../pricing/index.js';
import { firePluginHook } from '../../../plugin.js';
import { selectIncomingStrategy } from '../../../protocols/index.js';
import {
  fail,
  protocolInitError,
  resolveEarlyBody,
  runApiKeyGate,
  trySiwxFastPath,
  type FlowCtx,
} from '../../context/index.js';
import { invokePaidStatic } from './static-invoke.js';
import { build402 } from '../build402.js';
import { resolveStaticBodyAndPrice } from './static-body-and-price.js';
import { runStaticRequestFlow } from './static-request.js';

export async function runStaticPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps, report } = ctx;

  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return apiKeyGate.response;
  const { account } = apiKeyGate;

  const pricing = selectPricing(routeEntry.pricing, {
    alert: report,
    maxPrice: routeEntry.maxPrice,
    minPrice: routeEntry.minPrice,
    route: routeEntry.key,
  });

  const incomingStrategy = selectIncomingStrategy(request, routeEntry.protocols);

  const earlyResolution = await resolveEarlyBody({ ctx, pricing, incomingStrategy });
  if (!earlyResolution.ok) return earlyResolution.response;
  const { earlyBody } = earlyResolution;

  const siwxFastPath = await trySiwxFastPath(ctx, account);
  if (siwxFastPath) return siwxFastPath;

  if (!incomingStrategy) {
    const initError = protocolInitError(routeEntry, deps);
    if (initError) return fail(ctx, 500, initError);
    return build402(ctx, pricing, earlyBody);
  }

  const bodyAndPrice = await resolveStaticBodyAndPrice({ ctx, pricing });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verifyOutcome = await incomingStrategy.verify({
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
    protocol: incomingStrategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  const result = await invokePaidStatic(
    ctx,
    verifyOutcome.wallet,
    account,
    parsedBody,
    verifyOutcome.payment,
  );
  return runStaticRequestFlow({
    ctx,
    strategy: incomingStrategy,
    verifyOutcome,
    account,
    body: parsedBody,
    price,
    result,
  });
}
