import type { NextResponse } from 'next/server';
import { firePluginHook } from '../../../plugin.js';
import type { PaymentStrategy, SettleOutcome } from '../../../protocols/types.js';
import type { HandlerPaymentContext } from '../../../types.js';
import { grantEntitlementIfSiwx } from '../grant-entitlement.js';
import { runAfterSettle } from '../run-after-settle.js';
import type { FlowCtx, SettleScope } from '../types.js';
import { finalize } from './response.js';

export type SettleSuccess = Extract<SettleOutcome, { ok: true }>;
export type SettledScope = SettleScope<HandlerPaymentContext & { status: 'settled' }>;

export async function runPostSettleEpilogue(args: {
  ctx: FlowCtx;
  strategy: PaymentStrategy;
  wallet: string;
  settle: SettleSuccess;
  afterSettleScope: SettledScope;
  rawResult: unknown;
  body: unknown;
}): Promise<NextResponse> {
  const { ctx, strategy, wallet, settle, afterSettleScope, rawResult, body } = args;

  await grantEntitlementIfSiwx(ctx, wallet);
  firePluginHook(ctx.deps.plugin, 'onPaymentSettled', ctx.pluginCtx, {
    protocol: strategy.protocol,
    payer: wallet,
    transaction: settle.settledPayment.transaction ?? '',
    network: settle.settledPayment.network,
  });
  await runAfterSettle(ctx, afterSettleScope);
  return finalize(ctx, settle.response, rawResult, body);
}
