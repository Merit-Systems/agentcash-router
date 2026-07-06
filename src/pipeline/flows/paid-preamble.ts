import type { NextResponse } from 'next/server';
import { selectPricing, type PricingStrategy } from '../../pricing/index.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { PaymentStrategy, VerifySuccess } from '../../protocols/types.js';
import {
  fail,
  firePaymentVerified,
  protocolInitError,
  resolveEarlyBody,
  runApiKeyGate,
  trySiwxFastPath,
  type FlowCtx,
} from '../steps/index.js';
import { buildChallengeResponse } from './challenge-response.js';

export type PaidPreambleResult =
  | { done: true; response: NextResponse }
  | {
      done: false;
      account: unknown;
      pricing: PricingStrategy | null;
      incomingStrategy: PaymentStrategy;
      earlyBody: unknown;
    };

/**
 * Shared prefix of the static and dynamic paid flows:
 * API-key gate → pricing selection → strategy detection → early body →
 * SIWX fast path → 402 challenge when no payment credential is present.
 *
 * Returns `{ done: true }` when the request was fully answered (auth failure,
 * SIWX replay, challenge, or protocol init error) and `{ done: false }` with
 * the resolved context when the flow should proceed to payment verification.
 */
export async function runPaidPreamble(ctx: FlowCtx): Promise<PaidPreambleResult> {
  const { request, routeEntry, deps, report } = ctx;

  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return { done: true, response: apiKeyGate.response };
  const { account } = apiKeyGate;

  const pricing = selectPricing(routeEntry.pricing, {
    alert: report,
    maxPrice: routeEntry.maxPrice,
    minPrice: routeEntry.minPrice,
    route: routeEntry.key,
  });

  const incomingStrategy = selectIncomingStrategy(request, routeEntry.protocols);

  const earlyResolution = await resolveEarlyBody({ ctx, pricing, incomingStrategy });
  if (!earlyResolution.ok) return { done: true, response: earlyResolution.response };
  const { earlyBody } = earlyResolution;

  const siwxFastPath = await trySiwxFastPath(ctx, account);
  if (siwxFastPath) return { done: true, response: siwxFastPath };

  if (!incomingStrategy) {
    const initError = protocolInitError(routeEntry, deps);
    if (initError) return { done: true, response: fail(ctx, 500, initError) };
    return { done: true, response: await buildChallengeResponse(ctx, pricing, earlyBody) };
  }

  return { done: false, account, pricing, incomingStrategy, earlyBody };
}

export type PaidVerifyResult =
  | { ok: false; response: NextResponse }
  | { ok: true; verifyOutcome: VerifySuccess };

/**
 * Shared verify step of the static and dynamic paid flows: run the strategy's
 * `verify`, map config failures to a structured 500 and invalid payments to a
 * fresh 402 challenge, and fire the payment-verified plugin event on success.
 */
export async function runPaidVerify(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  pricing: PricingStrategy | null;
  parsedBody: unknown;
  price: string;
}): Promise<PaidVerifyResult> {
  const { ctx, strategy, pricing, parsedBody, price } = args;
  const { request, routeEntry, deps, report } = ctx;

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
      return { ok: false, response: fail(ctx, 500, verifyOutcome.message, parsedBody) };
    }
    return {
      ok: false,
      response: await buildChallengeResponse(ctx, pricing, parsedBody, verifyOutcome.failure),
    };
  }

  ctx.pluginCtx.setVerifiedWallet(verifyOutcome.wallet);
  firePaymentVerified(ctx, {
    protocol: strategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  return { ok: true, verifyOutcome };
}
