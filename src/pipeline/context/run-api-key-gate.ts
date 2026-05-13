import type { NextResponse } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { firePluginHook } from '../../plugin.js';
import { fail } from './fail.js';
import type { FlowCtx } from './types.js';

export type ApiKeyGateResult =
  | { ok: true; account: unknown }
  | { ok: false; response: NextResponse };

export async function runApiKeyGate(ctx: FlowCtx): Promise<ApiKeyGateResult> {
  const { request, routeEntry, deps } = ctx;

  if (!routeEntry.apiKeyResolver) return { ok: true, account: undefined };

  const apiKeyResult = await verifyApiKey(request, routeEntry.apiKeyResolver);
  if (!apiKeyResult.valid) {
    return { ok: false, response: fail(ctx, 401, 'Invalid or missing API key') };
  }

  firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    authMode: 'apiKey',
    wallet: null,
    route: routeEntry.key,
    account: apiKeyResult.account,
  });
  return { ok: true, account: apiKeyResult.account };
}
