import { NextResponse } from 'next/server';
import { selectPricing } from '../../pricing/index.js';
import { atomicToDecimal } from '../../pricing/atomic.js';
import { createTickMeter } from '../../pricing/tick-meter.js';
import { firePluginHook } from '../../plugin.js';
import { selectIncomingStrategy } from '../../protocols/index.js';
import type { AlertFn, HandlerPaymentContext } from '../../types.js';
import { build402 } from '../challenge.js';
import {
  errorMessage,
  fail,
  finalize,
  invoke,
  protocolInitError,
  resolveBodyAndPrice,
  resolveEarlyBody,
  resolvePreflight,
  runApiKeyGate,
  runBeforeSettle,
  runSettlementError,
  runSettledHandlerError,
  settleAndFinalizeRequest,
  settleAndFinalizeStream,
  trySiwxFastPath,
  type FlowCtx,
  type InvokeResult,
  type SettleScope,
} from '../context/index.js';

export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  // ---- 1. Optional API key gate (composes with payment) ----
  const apiKeyGate = await runApiKeyGate(ctx);
  if (!apiKeyGate.ok) return apiKeyGate.response;
  const { account } = apiKeyGate;

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

  // ---- 4. Early body parse + validate (no-credential path only — used so the
  //         402 advertises an accurate price and validate() rejects bad input). ----
  const earlyResolution = await resolveEarlyBody({ ctx, pricing, incomingStrategy });
  if (!earlyResolution.ok) return earlyResolution.response;
  const { earlyBody } = earlyResolution;

  // ---- 5. SIWX entitlement fast-path (paid+SIWX) ----
  const siwxFastPath = await trySiwxFastPath(ctx, account);
  if (siwxFastPath) return siwxFastPath;

  // ---- 6. No payment header → 402 challenge ----
  if (!incomingStrategy) {
    const initError = protocolInitError(routeEntry, deps);
    if (initError) return fail(ctx, 500, initError);
    return build402(ctx, pricing, earlyBody);
  }

  // ---- 6.5 Strategy preflight — runs only with a matched credential. MPP
  //          channel-management credentials skip body + handler here. ----
  const { skipBody, skipHandler } = resolvePreflight(incomingStrategy, request, routeEntry);

  // ---- 7. Payment present: body parse + validate + price ----
  const bodyAndPrice = await resolveBodyAndPrice({ ctx, pricing, skipBody });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  // ---- 8. Verify payment via the matched strategy ----
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

  const tickMeter = routeEntry.dynamicPrice
    ? createTickMeter({
        // builder.ts guarantees tickCost is set when dynamicPrice is true
        tickCost: routeEntry.tickCost!,
        maxPrice: routeEntry.maxPrice,
        route: routeEntry.key,
      })
    : null;

  const result: InvokeResult = skipHandler
    ? {
        kind: 'batch',
        response: new NextResponse(null, { status: 200 }),
        rawResult: undefined,
      }
    : await invoke(
        ctx,
        verifyOutcome.wallet,
        account,
        parsedBody,
        verifyOutcome.payment,
        tickMeter?.charge,
      );

  if (result.kind === 'stream') {
    if (!tickMeter) {
      return fail(
        ctx,
        500,
        `route '${routeEntry.key}': streaming handlers require .paid({ dynamic: true })`,
        parsedBody,
      );
    }
    return settleAndFinalizeStream({
      ctx,
      strategy: incomingStrategy,
      verifyOutcome,
      source: result.source,
      account,
      body: parsedBody,
      bindChannelCharge: tickMeter.bindChannelCharge,
    });
  }

  const settleScope: SettleScope = {
    wallet: verifyOutcome.wallet,
    account,
    body: parsedBody,
    payment: verifyOutcome.payment,
    response: result.response,
    rawResult: result.rawResult,
    handlerError: result.handlerError,
  };

  // Meter-zero short-circuit: if a handler ran on a dynamic route and never
  // billed, settle is skipped (the request was free). Doesn't apply when the
  // handler was bypassed via preflight — settle still has work to do.
  const handlerSkippedBilling =
    !skipHandler && tickMeter !== null && tickMeter.atomicTotal() === 0n;
  if (handlerSkippedBilling) {
    return finalize(ctx, result.response, result.rawResult, parsedBody);
  }

  const billedAmount = tickMeter ? atomicToDecimal(tickMeter.atomicTotal()) : price;

  if (verifyOutcome.alreadySettled) {
    if (result.response.status >= 400) {
      const settledScope = settleScope as SettleScope<
        HandlerPaymentContext & { status: 'settled' }
      >;
      await runSettledHandlerError(ctx, settledScope);
      return finalize(ctx, result.response, result.rawResult, parsedBody);
    }
    return settleAndFinalizeRequest({
      ctx,
      strategy: incomingStrategy,
      verifyOutcome,
      scope: settleScope,
      rawResult: result.rawResult,
      body: parsedBody,
      billedAmount,
    });
  }

  if (result.response.status >= 400) {
    return finalize(ctx, result.response, result.rawResult, parsedBody);
  }

  const beforeErr = await runBeforeSettle(ctx, settleScope);
  if (beforeErr) return beforeErr;

  return settleAndFinalizeRequest({
    ctx,
    strategy: incomingStrategy,
    verifyOutcome,
    scope: settleScope,
    rawResult: result.rawResult,
    body: parsedBody,
    billedAmount,
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
