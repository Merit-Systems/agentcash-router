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
import { buildStatic402 } from './static-402.js';
import { resolveStaticBodyAndPrice } from './static-body-and-price.js';
import { runStaticRequestFlow } from './static-request.js';

/**
 * Static-priced paid-route entry point. Price is fixed (or body-derived once)
 * — `billedAmount == price`. Handlers are always request-shaped (never
 * streams; the builder rejects async generators on static routes).
 *
 * Pipeline:
 *   1. apiKeyGate
 *   2. pricing + protocol strategy selection
 *   3. early body parse (for accurate 402 quotes / validate)
 *   4. SIWX entitlement fast-path
 *   5. no-credential → buildStatic402
 *   6. resolveStaticBodyAndPrice (no skipBody — channel-mgmt is dynamic-only)
 *   7. verifyStatic (rejects session credentials)
 *   8. invokeStatic → runStaticRequestFlow
 */
export async function runStaticPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return apiKeyGate.response;
  const { account } = apiKeyGate;

  const pricing = selectPricing(routeEntry.pricing, {
    alert: (level, message, meta) =>
      firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
        level,
        message,
        route: routeEntry.key,
        meta,
      }),
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
    return buildStatic402(ctx, pricing, earlyBody);
  }

  const bodyAndPrice = await resolveStaticBodyAndPrice({ ctx, pricing });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verifyOutcome = await incomingStrategy.verifyStatic({
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
    return buildStatic402(ctx, pricing, parsedBody);
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
