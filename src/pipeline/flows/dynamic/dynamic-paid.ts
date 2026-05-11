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
import { build402 } from '../build402.js';
import { resolveDynamicBodyAndPrice } from './dynamic-body-and-price.js';
import { runDynamicChannelMgmtFlow } from './dynamic-channel-mgmt.js';
import { invokeDynamic } from './dynamic-invoke.js';
import { resolveDynamicPreflight } from './dynamic-preflight.js';
import { runDynamicRequestFlow } from './dynamic-request.js';
import { runDynamicStreamFlow } from './dynamic-stream.js';

/**
 * Dynamic-priced paid-route entry point. Handler bills via `charge()` calls;
 * settlement uses the running total (x402 `upto`) or per-tick voucher debits
 * (MPP session).
 *
 * Pipeline:
 *   1. apiKeyGate
 *   2. pricing + protocol strategy selection
 *   3. early body parse (for accurate 402 quotes / validate)
 *   4. SIWX entitlement fast-path
 *   5. no-credential → build402
 *   6. preflight (channel-mgmt credentials skip handler)
 *   7. resolveDynamicBodyAndPrice (with skipBody)
 *   8. verify (rejects charge credentials on dynamic routes)
 *   9. invokeDynamic → stream or request lifecycle
 */
export async function runDynamicPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
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
    return build402(ctx, pricing, earlyBody);
  }

  const { skipBody, skipHandler } = resolveDynamicPreflight(incomingStrategy, request, routeEntry);

  if (skipHandler) {
    return runDynamicChannelMgmtFlow({
      ctx,
      strategy: incomingStrategy,
      account,
      pricing,
      skipBody,
    });
  }

  const bodyAndPrice = await resolveDynamicBodyAndPrice({ ctx, pricing, skipBody });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verifyOutcome = await incomingStrategy.verify({
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
    return build402(ctx, pricing, parsedBody);
  }

  ctx.pluginCtx.setVerifiedWallet(verifyOutcome.wallet);
  firePluginHook(deps.plugin, 'onPaymentVerified', ctx.pluginCtx, {
    protocol: incomingStrategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  const result = await invokeDynamic(
    ctx,
    verifyOutcome.wallet,
    account,
    parsedBody,
    verifyOutcome.payment,
  );
  switch (result.kind) {
    case 'stream':
      return runDynamicStreamFlow({
        ctx,
        strategy: incomingStrategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
    case 'request':
      return runDynamicRequestFlow({
        ctx,
        strategy: incomingStrategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
  }
}
