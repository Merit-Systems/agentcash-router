import type { NextResponse } from 'next/server';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { verifySIWX } from '../../auth/siwx.js';
import { HEADERS } from '../../headers.js';
import { fireAuthVerified } from '../../plugin/events.js';
import { runHandlerOnly } from './run-handler-only.js';
import type { FlowCtx } from './types.js';

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

  fireAuthVerified(ctx, { authMode: 'siwx', wallet });
  return runHandlerOnly(ctx, wallet, account);
}
