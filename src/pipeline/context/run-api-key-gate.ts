import type { NextResponse } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { firePluginHook } from '../../plugin.js';
import { fail } from './fail.js';
import type { FlowCtx } from './types.js';

export type ApiKeyGateResult =
  | { ok: true; account: unknown }
  | { ok: false; response: NextResponse };

/**
 * Optional API-key gate that composes with payment. Three exit cases:
 *
 *   1. No `apiKeyResolver` on the route — no gate; `account: undefined`.
 *   2. Resolver accepts the key — fires `onAuthVerified` and returns the
 *      account value the resolver returned.
 *   3. Resolver rejects (or the key is missing) — 401.
 */
export async function runApiKeyGate(ctx: FlowCtx): Promise<ApiKeyGateResult> {
  const { request, routeEntry, deps } = ctx;

  // Case 1: no gate configured
  if (!routeEntry.apiKeyResolver) return { ok: true, account: undefined };

  const apiKeyResult = await verifyApiKey(request, routeEntry.apiKeyResolver);

  // Case 3: rejected
  if (!apiKeyResult.valid) {
    return { ok: false, response: fail(ctx, 401, 'Invalid or missing API key') };
  }

  // Case 2: accepted
  firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    authMode: 'apiKey',
    wallet: null,
    route: routeEntry.key,
    account: apiKeyResult.account,
  });
  return { ok: true, account: apiKeyResult.account };
}
