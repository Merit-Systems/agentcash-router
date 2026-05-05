import type { NextResponse } from 'next/server';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { verifySIWX } from '../../auth/siwx.js';
import { HEADERS } from '../../headers.js';
import { firePluginHook } from '../../plugin.js';
import { runHandlerOnly } from './run-handler-only.js';
import type { FlowCtx } from './types.js';

/**
 * Paid+SIWX entitlement fast-path. If the request carries a valid SIWX header
 * and the wallet already holds an entitlement for this route, skip the payment
 * flow and run the handler directly. Returns null to fall through to payment
 * verification when any precondition is missing — invalid SIWX never fails fast.
 */
export async function trySiwxFastPath(
  ctx: FlowCtx,
  account: unknown,
): Promise<NextResponse | null> {
  const { request, routeEntry, deps } = ctx;

  if (!routeEntry.siwxEnabled) return null;

  const siwxHeader = request.headers.get(HEADERS.SIWX);
  if (!siwxHeader) return null;

  const siwx = await verifySIWX(request, routeEntry, deps.nonceStore);
  if (!siwx.valid) return null;

  const wallet = normalizeWalletAddress(siwx.wallet);
  ctx.pluginCtx.setVerifiedWallet(wallet);

  const entitled = await deps.entitlementStore.has(routeEntry.key, wallet);
  if (!entitled) return null;

  firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    authMode: 'siwx',
    wallet,
    route: routeEntry.key,
  });
  return runHandlerOnly(ctx, wallet, account);
}
