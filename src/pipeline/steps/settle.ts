/**
 * Settlement lifecycle: the `.settlement()` hook dispatchers (beforeSettle /
 * afterSettle / onSettlementError / onSettledHandlerError), SIWX entitlement
 * grants, and the settle-and-finalize tails shared by request and stream
 * flows.
 */
import type { PaymentStrategy, SettleOutcome, VerifySuccess } from '../../protocols/types.js';
import type { HandlerPaymentContext } from '../../types.js';
import { firePaymentSettled } from '../../plugin/events.js';
import { errorMessage, errorStatus, handlerFailureError } from './context.js';
import { fail, finalize } from './respond.js';
import type { FlowCtx, SettleScope } from './types.js';

function settlementContext<TPayment extends HandlerPaymentContext>(
  ctx: FlowCtx,
  scope: SettleScope<TPayment>,
) {
  return {
    route: ctx.routeEntry.key,
    request: ctx.request,
    body: scope.body,
    wallet: scope.wallet,
    account: scope.account,
    payment: scope.payment,
    response: scope.response,
    result: scope.rawResult,
  };
}

export async function runBeforeSettle(ctx: FlowCtx, scope: SettleScope): Promise<Response | null> {
  const hook = ctx.routeEntry.settlement?.beforeSettle;
  if (!hook) return null;
  try {
    await hook(settlementContext(ctx, scope));
    return null;
  } catch (error) {
    return fail(
      ctx,
      errorStatus(error, 500),
      errorMessage(error, 'Pre-settlement validation failed'),
      scope.body,
    );
  }
}

async function runAfterSettle(
  ctx: FlowCtx,
  scope: SettleScope<HandlerPaymentContext & { status: 'settled' }>,
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.afterSettle;
  if (!hook) return;
  try {
    await hook(settlementContext(ctx, scope));
  } catch (error) {
    const message = errorMessage(error, 'Post-settlement hook failed');
    ctx.report('error', `Post-settlement hook failed: ${message}`);
    await runSettlementError(ctx, scope, error, 'afterSettle');
  }
}

export async function runSettlementError(
  ctx: FlowCtx,
  scope: SettleScope,
  error: unknown,
  phase: 'settle' | 'afterSettle',
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.onSettlementError;
  if (!hook) return;
  try {
    await hook({ ...settlementContext(ctx, scope), error, phase });
  } catch (hookError) {
    const message = errorMessage(hookError, 'Settlement error hook failed');
    ctx.report('error', `Settlement error hook failed: ${message}`);
  }
}

export async function runSettledHandlerError(
  ctx: FlowCtx,
  scope: SettleScope<HandlerPaymentContext & { status: 'settled' }>,
  error: unknown = scope.handlerError ?? handlerFailureError(scope.response),
): Promise<void> {
  const hook = ctx.routeEntry.settlement?.onSettledHandlerError;
  if (!hook) return;
  try {
    await hook({ ...settlementContext(ctx, scope), error });
  } catch (hookError) {
    const message = errorMessage(hookError, 'Settled handler error hook failed');
    ctx.report('error', `Settled handler error hook failed: ${message}`);
  }
}

async function grantEntitlementIfSiwx(ctx: FlowCtx, wallet: string): Promise<void> {
  if (!ctx.routeEntry.siwxEnabled) return;
  try {
    await ctx.deps.entitlementStore.grant(ctx.routeEntry.key, wallet);
  } catch (error) {
    ctx.report(
      'warn',
      `Entitlement grant failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

type SettleSuccess = Extract<SettleOutcome, { ok: true }>;
type SettledScope = SettleScope<HandlerPaymentContext & { status: 'settled' }>;

async function runPostSettleEpilogue(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  wallet: string;
  settle: SettleSuccess;
  afterSettleScope: SettledScope;
  rawResult: unknown;
  body: unknown;
}): Promise<Response> {
  const { ctx, strategy, wallet, settle, afterSettleScope, rawResult, body } = args;

  await grantEntitlementIfSiwx(ctx, wallet);
  firePaymentSettled(ctx, {
    protocol: strategy.protocol,
    payer: wallet,
    transaction: settle.settledPayment.transaction ?? '',
    network: settle.settledPayment.network,
  });
  await runAfterSettle(ctx, afterSettleScope);
  return finalize(ctx, settle.response, rawResult, body);
}

export async function settleAndFinalizeRequest(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  scope: SettleScope;
  rawResult: unknown;
  body: unknown;
  billedAmount: string;
  onSettleError?: (error: unknown, failMessage: string) => Promise<void>;
}): Promise<Response> {
  const { ctx, strategy, verifyOutcome, scope, rawResult, body, billedAmount, onSettleError } =
    args;
  const { request, routeEntry, deps, report } = ctx;

  const settle = await strategy.settle({
    request,
    response: scope.response,
    payment: verifyOutcome.payment,
    token: verifyOutcome.token,
    routeEntry,
    deps,
    billedAmount,
    report,
  });

  if (!settle.ok) {
    if (onSettleError) await onSettleError(settle.error, settle.failMessage);
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body, {
      cause: settle.error,
    });
  }

  return runPostSettleEpilogue({
    ctx,
    strategy,
    wallet: verifyOutcome.wallet,
    settle,
    afterSettleScope: {
      ...scope,
      payment: settle.settledPayment,
      response: settle.response,
    },
    rawResult,
    body,
  });
}

export async function settleAndFinalizeStream(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  verifyOutcome: VerifySuccess;
  source: AsyncIterable<unknown>;
  account: unknown;
  body: unknown;
  bindChannelCharge: (fn: (() => Promise<void>) | null) => void;
}): Promise<Response> {
  const { ctx, strategy, verifyOutcome, source, account, body, bindChannelCharge } = args;
  const { request, routeEntry, deps, report } = ctx;

  if (!strategy.settleStream) {
    return fail(ctx, 500, `${strategy.protocol} does not support streaming handlers`, body);
  }

  const settle = await strategy.settleStream({
    request,
    source,
    payment: verifyOutcome.payment,
    token: verifyOutcome.token,
    routeEntry,
    deps,
    bindChannelCharge,
    report,
  });

  if (!settle.ok) {
    return fail(ctx, settle.failStatus ?? 500, settle.failMessage, body, {
      cause: settle.error,
    });
  }

  return runPostSettleEpilogue({
    ctx,
    strategy,
    wallet: verifyOutcome.wallet,
    settle,
    afterSettleScope: {
      wallet: verifyOutcome.wallet,
      account,
      body,
      payment: settle.settledPayment,
      response: settle.response,
      rawResult: undefined,
    },
    rawResult: undefined,
    body,
  });
}
