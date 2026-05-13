import type { NextResponse } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { fail, fireAuthVerified, type FlowCtx, runHandlerOnly } from '../steps/index.js';

export async function runApiKeyOnlyFlow(ctx: FlowCtx): Promise<NextResponse> {
  if (!ctx.routeEntry.apiKeyResolver) {
    return fail(ctx, 401, 'API key resolver not configured');
  }
  const result = await verifyApiKey(ctx.request, ctx.routeEntry.apiKeyResolver);
  if (!result.valid) return fail(ctx, 401, 'Invalid or missing API key');

  fireAuthVerified(ctx, { authMode: 'apiKey', wallet: null, account: result.account });

  return runHandlerOnly(ctx, null, result.account);
}
