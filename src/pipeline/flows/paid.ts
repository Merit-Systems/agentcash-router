import type { NextResponse } from 'next/server';
import { selectPricing } from '../../pricing/index.js';
import { firePluginHook } from '../../plugin.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { AlertFn } from '../../types.js';
import { build402 } from '../challenge.js';
import {
  fail,
  protocolInitError,
  resolveBodyAndPrice,
  resolveEarlyBody,
  resolvePreflight,
  runApiKeyGate,
  trySiwxFastPath,
  type FlowCtx,
} from '../context/index.js';
import { invokeDynamic } from './dynamic/dynamic-invoke.js';
import { runDynamicRequestFlow } from './dynamic/dynamic-request.js';
import { runDynamicStreamFlow } from './dynamic/dynamic-stream.js';
import { runChannelMgmtFlow } from './paid-channel-mgmt.js';
import { invokeStatic } from './static/static-invoke.js';
import { runStaticRequestFlow } from './static/static-request.js';

/**
 * Paid-route entry point. Owns the shared prefix (gates, pricing, protocol
 * selection, body parse, validate, verify) then forks on `routeEntry.dynamicPrice`:
 *
 *   - skipHandler (preflight channel-mgmt credential) → runChannelMgmtFlow
 *   - dynamic route:
 *       - invokeDynamic → stream   → runDynamicStreamFlow
 *       - invokeDynamic → request  → runDynamicRequestFlow
 *   - static route:
 *       - invokeStatic            → runStaticRequestFlow (streams blocked at builder)
 *
 * Each lifecycle owns its full settlement story; this file just routes.
 */
export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return apiKeyGate.response;
  const { account } = apiKeyGate;

  const alertFn: AlertFn = (level, message, meta) => {
    firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
      level,
      message,
      route: routeEntry.key,
      meta,
    });
  };
  const pricing = selectPricing(routeEntry.pricing, {
    alert: alertFn,
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

  const { skipBody, skipHandler } = resolvePreflight(incomingStrategy, request, routeEntry);

  if (skipHandler) {
    return runChannelMgmtFlow({ ctx, strategy: incomingStrategy, account, pricing, skipBody });
  }

  const bodyAndPrice = await resolveBodyAndPrice({ ctx, pricing, skipBody });
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

  if (routeEntry.dynamicPrice) {
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

  const result = await invokeStatic(
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
