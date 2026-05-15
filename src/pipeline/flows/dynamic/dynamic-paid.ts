import type { NextResponse } from 'next/server';
import { selectPricing } from '../../../pricing/index.js';
import { selectIncomingStrategy } from '../../../protocols/index.js';
import {
  fail,
  firePaymentVerified,
  protocolInitError,
  resolveEarlyBody,
  runApiKeyGate,
  trySiwxFastPath,
  type FlowCtx,
} from '../../steps/index.js';
import { buildChallengeResponse } from '../challenge-response.js';
import { resolveDynamicBodyAndPrice } from './dynamic-body-and-price.js';
import { runDynamicChannelMgmtFlow } from './dynamic-channel-mgmt.js';
import { invokeMetered, invokeUpto } from './dynamic-invoke/index.js';
import { resolveDynamicPreflight } from './dynamic-preflight.js';
import { runDynamicRequestFlow } from './dynamic-request.js';
import { runDynamicStreamFlow } from './dynamic-stream.js';
import type { VerifySuccess } from '../../../protocols/types.js';
import type { DynamicInvokeResult } from '../../steps/types.js';

export async function runDynamicPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
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
    return buildChallengeResponse(ctx, pricing, earlyBody);
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
    report,
  });

  if (verifyOutcome.ok === false) {
    if (verifyOutcome.kind === 'config') {
      return fail(ctx, 500, verifyOutcome.message, parsedBody);
    }
    return buildChallengeResponse(ctx, pricing, parsedBody, verifyOutcome.failure);
  }

  ctx.pluginCtx.setVerifiedWallet(verifyOutcome.wallet);
  firePaymentVerified(ctx, {
    protocol: incomingStrategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  const result = await invokeDynamic(ctx, verifyOutcome, account, parsedBody);

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
