import type { NextResponse } from 'next/server';
import { verifyApiKey } from '../../auth/api-key.js';
import { firePluginHook } from '../../plugin.js';
import { fail, type FlowCtx, runHandlerOnly } from '../steps/index.js';

export async function runApiKeyOnlyFlow(ctx: FlowCtx): Promise<NextResponse> {
  if (!ctx.routeEntry.apiKeyResolver) {
    return fail(ctx, 401, 'API key resolver not configured');
  }
  const result = await verifyApiKey(ctx.request, ctx.routeEntry.apiKeyResolver);
  if (!result.valid) return fail(ctx, 401, 'Invalid or missing API key');

  firePluginHook(ctx.deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    authMode: 'apiKey',
    wallet: null,
    route: ctx.routeEntry.key,
    account: result.account,
  });

  return runHandlerOnly(ctx, null, result.account);
}
