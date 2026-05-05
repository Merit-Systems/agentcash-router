import type { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { selectPricing } from '../../pricing/index.js';
import { firePluginHook } from '../../plugin.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { AlertFn, HandlerPaymentContext } from '../../types.js';
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

  // ---- 9. Invoke handler ----
  const result = await invoke(ctx, verifyOutcome.wallet, account, body.data, verifyOutcome.payment);

  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body: body.data,
    payment: verifyOutcome.payment,
    response: result.response,
    rawResult: result.rawResult,
    handlerError: result.handlerError,
  };

  // ---- 10. Settlement ----
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
