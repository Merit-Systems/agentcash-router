import { verifyApiKey } from '../../auth/api-key.js';
import { fail } from './fail.js';
import { fireAuthVerified } from '../../plugin/events.js';
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
