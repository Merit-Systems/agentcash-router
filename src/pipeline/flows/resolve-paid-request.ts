/**
 * Shared prologue for every paid flow: api-key gate → pricing selection →
 * incoming-strategy detection → early body → SIWX fast path → 402 challenge
 * (no credential) → body+price → payment verification. Static and dynamic
 * tails consume the discriminated {@link PaidResolution}; MPP
 * channel-management requests (open/top-up with no handler work) are settled
 * here directly.
 */
import { selectPricing, type PricingStrategy } from '../../pricing/index.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { PaymentStrategy, VerifySuccess } from '../../protocols/types.js';
import {
  errorMessage,
  fail,
  firePaymentVerified,
  protocolInitError,
  resolveBodyAndPrice,
  resolveEarlyBody,
  runApiKeyGate,
  runBeforeSettle,
  runSettlementError,
  settleAndFinalizeRequest,
  trySiwxFastPath,
  type FlowCtx,
  type SettleScope,
} from '../steps/index.js';
import { buildChallengeResponse } from './challenge-response.js';

export type PaidResolution =
  /** Challenge, gate failure, or error response — return it as-is. */
  | { kind: 'response'; response: Response }
  /** Payment verified; invoke the handler and settle. */
  | {
      kind: 'verified';
      account: unknown;
      strategy: PaymentStrategy;
      parsedBody: unknown;
      price: string;
      verifyOutcome: VerifySuccess;
    };

export async function resolvePaidRequest(ctx: FlowCtx): Promise<PaidResolution> {
  const { request, routeEntry, deps, report } = ctx;

  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return { kind: 'response', response: apiKeyGate.response };
  const { account } = apiKeyGate;

  const pricing = selectPricing(routeEntry.pricing, {
    alert: report,
    maxPrice: routeEntry.maxPrice,
    minPrice: routeEntry.minPrice,
    route: routeEntry.key,
  });

  const strategy = selectIncomingStrategy(request, routeEntry.protocols);

  const earlyResolution = await resolveEarlyBody({ ctx, pricing, incomingStrategy: strategy });
  if (!earlyResolution.ok) return { kind: 'response', response: earlyResolution.response };
  const { earlyBody } = earlyResolution;

  const siwxFastPath = await trySiwxFastPath(ctx, account);
  if (siwxFastPath) return { kind: 'response', response: siwxFastPath };

  if (!strategy) {
    const initError = protocolInitError(routeEntry, deps);
    if (initError) return { kind: 'response', response: fail(ctx, 500, initError) };
    return { kind: 'response', response: await buildChallengeResponse(ctx, pricing, earlyBody) };
  }

  // Handler-charged billing (upto/metered) lets the strategy claim the
  // request before the handler runs — MPP channel open/top-up carries no body
  // and never reaches the handler.
  let skipBody = false;
  if (routeEntry.billing !== 'exact') {
    const preflightOutcome = strategy.preflight?.(request, routeEntry) ?? null;
    skipBody = preflightOutcome?.skipBody ?? false;
    if (preflightOutcome?.skipHandler) {
      return {
        kind: 'response',
        response: await runChannelMgmtFlow({ ctx, strategy, account, pricing, skipBody }),
      };
    }
  }

  const verification = await verifyPaidRequest(ctx, { strategy, pricing, skipBody });
  if (!verification.ok) return { kind: 'response', response: verification.response };

  return {
    kind: 'verified',
    account,
    strategy,
    parsedBody: verification.parsedBody,
    price: verification.price,
    verifyOutcome: verification.verifyOutcome,
  };
}

export type PaidVerification =
  | { ok: false; response: Response }
  | { ok: true; parsedBody: unknown; price: string; verifyOutcome: VerifySuccess };

/**
 * Body+price resolution → strategy verification → verified-wallet plumbing.
 * Shared by the main paid prologue and the channel-management settle path.
 */
export async function verifyPaidRequest(
  ctx: FlowCtx,
  args: { strategy: PaymentStrategy; pricing: PricingStrategy | null; skipBody?: boolean },
): Promise<PaidVerification> {
  const { strategy, pricing, skipBody } = args;
  const { request, routeEntry, deps, report } = ctx;

  const bodyAndPrice = await resolveBodyAndPrice({ ctx, pricing, skipBody });
  if (!bodyAndPrice.ok) return { ok: false, response: bodyAndPrice.response };
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

  return { ok: true, parsedBody, price, verifyOutcome };
}

/**
 * MPP channel management (open / top-up): verify the payment, then settle
 * against a synthetic 200 with zero billed amount — no handler involved.
 */
async function runChannelMgmtFlow(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  account: unknown;
  pricing: PricingStrategy | null;
  skipBody: boolean;
}): Promise<Response> {
  const { ctx, strategy, account, pricing, skipBody } = args;
  const { report } = ctx;

  const verification = await verifyPaidRequest(ctx, { strategy, pricing, skipBody });
  if (!verification.ok) return verification.response;
  const { parsedBody, verifyOutcome } = verification;

  const synthetic = new Response(null, { status: 200 });
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
