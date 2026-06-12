/**
 * Identity gates and the no-payment handler path. `runApiKeyGate` enforces
 * `.apiKey()` before any payment work; `trySiwxFastPath` lets an entitled
 * SIWX wallet skip repeat payment on paid routes; `runHandlerOnly` is the
 * parse → validate → invoke → finalize path shared by every flow that
 * reaches the handler without settling a payment.
 */
import { verifyApiKey } from '../../auth/api-key.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { verifySIWX } from '../../auth/siwx.js';
import { HEADERS } from '../../headers.js';
import { fireAuthVerified } from '../../plugin/events.js';
import { invokeUnauthed } from '../flows/invoke.js';
import { parseBody, runValidate } from './body.js';
import { fail, finalize } from './respond.js';
import type { FlowCtx } from './types.js';

export type ApiKeyGateResult = { ok: true; account: unknown } | { ok: false; response: Response };

export async function runApiKeyGate(ctx: FlowCtx): Promise<ApiKeyGateResult> {
  const { request, routeEntry } = ctx;

  if (!routeEntry.apiKeyResolver) return { ok: true, account: undefined };

  const apiKeyResult = await verifyApiKey(request, routeEntry.apiKeyResolver);
  if (!apiKeyResult.valid) {
    return { ok: false, response: fail(ctx, 401, 'Invalid or missing API key') };
  }

  fireAuthVerified(ctx, { authMode: 'apiKey', wallet: null, account: apiKeyResult.account });
  return { ok: true, account: apiKeyResult.account };
}

export async function trySiwxFastPath(ctx: FlowCtx, account: unknown): Promise<Response | null> {
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

export async function runHandlerOnly(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
): Promise<Response> {
  const body = await parseBody(ctx);
  if (!body.ok) return body.response;

  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) return validateErr;

  const result = await invokeUnauthed(ctx, wallet, account, body.data);
  return finalize(
    ctx,
    result.response,
    result.rawResult,
    body.data,
    result.handlerError === undefined ? undefined : { cause: result.handlerError },
  );
}
