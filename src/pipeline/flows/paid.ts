import { NextResponse, type NextRequest } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { selectPricing } from '../../pricing/index.js';
import { firePluginHook } from '../../plugin.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { AlertFn, ChargeFn, HandlerPaymentContext } from '../../types.js';
import { build402 } from '../challenge.js';
import {
  errorMessage,
  errorStatus,
  fail,
  finalize,
  firePluginResponse,
  invoke,
  parseBody,
  protocolInitError,
  runBeforeSettle,
  runSettlementError,
  runSettledHandlerError,
  runValidate,
  settleAndFinalize,
  shouldParseBodyEarly,
  trySiwxFastPath,
  type FlowCtx,
  type SettleScope,
} from '../context/index.js';

export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  // ---- 1. Optional API key gate (composes with payment) ----
  let account: unknown = undefined;
  if (routeEntry.apiKeyResolver) {
    const apiKeyResult = await verifyApiKey(request, routeEntry.apiKeyResolver);
    if (!apiKeyResult.valid) return fail(ctx, 401, 'Invalid or missing API key');
    account = apiKeyResult.account;
    firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
      authMode: 'apiKey',
      wallet: null,
      route: routeEntry.key,
      account,
    });
  }

  // ---- 2. Pricing strategy (per-request to capture alert callback) ----
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

  // ---- 3. Incoming protocol detection ----
  const incomingStrategy = selectIncomingStrategy(request, routeEntry.protocols);

  // ---- 4. Early body parse + validate (for dynamic pricing or validateFn) ----
  let earlyBody: unknown = undefined;
  if (shouldParseBodyEarly(incomingStrategy, routeEntry, pricing)) {
    const earlyClone = request.clone() as NextRequest;
    const earlyResult = await parseBody(earlyClone, routeEntry);
    if (earlyResult.ok) {
      earlyBody = earlyResult.data;
      const validateErr = await runValidate(ctx, earlyBody);
      if (validateErr) return validateErr;
    } else {
      firePluginResponse(ctx, earlyResult.response);
      return earlyResult.response;
    }
  }

  // ---- 5. SIWX entitlement fast-path (paid+SIWX) ----
  const siwxFastPath = await trySiwxFastPath(ctx, account);
  if (siwxFastPath) return siwxFastPath;

  // ---- 6. No payment header → 402 challenge ----
  if (!incomingStrategy) {
    const initError = protocolInitError(routeEntry, deps);
    if (initError) return fail(ctx, 500, initError);
    return build402(ctx, pricing, earlyBody);
  }

  // ---- 7. Payment present: full body parse + validate + price ----
  const body = await parseBody(request, routeEntry);
  if (!body.ok) {
    firePluginResponse(ctx, body.response);
    return body.response;
  }

  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) return validateErr;

  if (!pricing) {
    return fail(ctx, 500, 'Pricing not configured', body.data);
  }

  let price: string;
  try {
    price = await pricing.quote(body.data);
  } catch (err) {
    return fail(
      ctx,
      errorStatus(err, 500),
      errorMessage(err, 'Price calculation failed'),
      body.data,
    );
  }

  // ---- 8. Verify payment via the matched strategy ----
  const verifyOutcome = await incomingStrategy.verify({
    request,
    body: body.data,
    price,
    routeEntry,
    deps,
  });

  if (verifyOutcome.ok === false) {
    if (verifyOutcome.kind === 'config') {
      return fail(ctx, 500, verifyOutcome.message, body.data);
    }
    return build402(ctx, pricing, body.data);
  }

  ctx.pluginCtx.setVerifiedWallet(verifyOutcome.wallet);
  firePluginHook(deps.plugin, 'onPaymentVerified', ctx.pluginCtx, {
    protocol: incomingStrategy.protocol,
    payer: verifyOutcome.wallet,
    amount: price,
    network: verifyOutcome.payment.network,
  });

  // ---- 9. Build charge callback for dynamic-priced routes ----
  // The handler accumulates a running total via `charge(amount)`. After the
  // handler resolves, the orchestrator forwards the total to settle as
  // `effectiveAmount`. If the handler never calls charge, settle is skipped —
  // the request was free. Static-priced routes don't expose `charge`; their
  // `effectiveAmount` is the quoted price.
  const chargeState = routeEntry.dynamicPrice
    ? createChargeState(routeEntry.maxPrice, routeEntry.key)
    : null;

  // ---- 10. Invoke handler ----
  const result = await invoke(
    ctx,
    verifyOutcome.wallet,
    account,
    body.data,
    verifyOutcome.payment,
    chargeState?.charge,
  );

  // ---- 11. Streaming branch — handler returned an AsyncIterable ----
  if (result.kind === 'stream') {
    if (!incomingStrategy.settleStream) {
      return fail(
        ctx,
        500,
        `${incomingStrategy.protocol} does not support streaming handlers`,
        body.data,
      );
    }
    const streamOutcome = await incomingStrategy.settleStream({
      request,
      source: result.source,
      payment: verifyOutcome.payment,
      token: verifyOutcome.token,
      routeEntry,
      deps,
    });
    if (!streamOutcome.ok) {
      return fail(ctx, streamOutcome.failStatus ?? 500, streamOutcome.failMessage, body.data);
    }
    return finalize(ctx, streamOutcome.response, undefined, body.data);
  }

  // ---- 12. Batch branch ----
  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body: body.data,
    payment: verifyOutcome.payment,
    response: result.response,
    rawResult: result.rawResult,
    handlerError: result.handlerError,
  };

  // Dynamic-priced routes that never called charge() opt out of settle
  // entirely — the request ran free. The handler's response is returned
  // unchanged.
  if (chargeState && chargeState.totalAtomic() === 0n) {
    return finalize(ctx, result.response, result.rawResult, body.data);
  }

  // For dynamic routes, the effective amount is the running charge total
  // (guaranteed > 0 by the early-return above). For static routes, it's the
  // verified price — same value the strategy committed to at verify time.
  const effectiveAmount = chargeState
    ? atomicToDecimal(chargeState.totalAtomic())
    : price;

  // ---- 13. Settlement ----
  if (verifyOutcome.alreadySettled) {
    // Payment is already on-chain (e.g., MPP hash-payload).
    if (result.response.status >= 400) {
      const settledScope = settleScope as SettleScope<
        HandlerPaymentContext & { status: 'settled' }
      >;
      await runSettledHandlerError(ctx, settledScope);
      return finalize(ctx, result.response, result.rawResult, body.data);
    }
    return settleAndFinalize({
      ctx,
      strategy: incomingStrategy,
      verifyOutcome,
      scope: settleScope,
      rawResult: result.rawResult,
      body: body.data,
      effectiveAmount,
    });
  }

  // Verified-but-not-settled (x402, mpp-tx) — settle only on handler success.
  if (result.response.status >= 400) {
    return finalize(ctx, result.response, result.rawResult, body.data);
  }

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

  return settleAndFinalize({
    ctx,
    strategy: incomingStrategy,
    verifyOutcome,
    scope: settleScope,
    rawResult: result.rawResult,
    body: body.data,
    effectiveAmount,
    onSettleError: async (error, failMessage) => {
      await runSettlementError(ctx, settleScope, error, 'settle');
      firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
        level: 'critical' as const,
        message: `${incomingStrategy.protocol} ${failMessage}: ${errorMessage(error, 'unknown')}`,
        route: routeEntry.key,
      });
    },
  });
}

/**
 * Per-request charge accumulator, returned to handlers as the `charge` callback.
 *
 * `charge` parses decimal-dollar input to atomic units (USDC 6-decimal) and
 * adds to a running bigint. If the running total would exceed `maxPrice`, the
 * call throws synchronously — the handler-author bug surfaces at the offending
 * call site rather than waiting for an on-chain revert.
 *
 * The handler may call `charge` zero, one, or many times. Zero calls means the
 * request runs free. Multi-call is additive (charge('0.01') + charge('0.02')
 * leaves a running total of 0.03).
 */
function createChargeState(maxPrice: string | undefined, route: string) {
  const maxAtomic = maxPrice !== undefined ? decimalToAtomic(maxPrice) : null;
  let runningAtomic = 0n;

  const charge: ChargeFn = async (amount: string) => {
    const delta = decimalToAtomic(amount);
    if (delta < 0n) {
      throw Object.assign(new Error(`route '${route}': charge() amount must be non-negative`), {
        status: 400,
      });
    }
    const next = runningAtomic + delta;
    if (maxAtomic !== null && next > maxAtomic) {
      throw Object.assign(
        new Error(
          `route '${route}': charge() running total ($${atomicToDecimal(next)}) exceeds maxPrice ($${atomicToDecimal(maxAtomic)})`,
        ),
        { status: 400, code: 'CHARGE_OVER_CAP' as const },
      );
    }
    runningAtomic = next;
  };

  return {
    charge,
    totalAtomic: () => runningAtomic,
  };
}

/** USDC has 6 decimals — used as the canonical atomic-unit conversion for charge() amounts. */
const DECIMALS = 6;

function decimalToAtomic(amount: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) {
    throw Object.assign(
      new Error(`charge() amount '${amount}' is not a valid decimal-dollar string`),
      { status: 400 },
    );
  }
  const whole = m[1];
  const fraction = (m[2] ?? '').slice(0, DECIMALS).padEnd(DECIMALS, '0');
  return BigInt(`${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0');
}

function atomicToDecimal(atomic: bigint): string {
  const whole = atomic / 10n ** BigInt(DECIMALS);
  const fraction = atomic % 10n ** BigInt(DECIMALS);
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}
