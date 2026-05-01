import type { NextResponse } from 'next/server';
import { finalize } from './finalize.js';
import { firePluginResponse } from './fire-plugin-response.js';
import { invoke } from './invoke.js';
import { parseBody } from './parse-body.js';
import { runValidate } from './run-validate.js';
import type { FlowCtx } from './types.js';

/**
 * No-payment tail used by unprotected, apiKey-only, siwx-only flows, and the
 * paid+SIWX entitlement fast-path: parse body → validate → invoke → finalize.
 */
export async function runHandlerOnly(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
): Promise<NextResponse> {
  const body = await parseBody(ctx.request, ctx.routeEntry);
  if (!body.ok) {
    firePluginResponse(ctx, body.response);
    return body.response;
  }

  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) return validateErr;

  const result = await invoke(ctx, wallet, account, body.data, null);
  return finalize(ctx, result.response, result.rawResult, body.data);
}
