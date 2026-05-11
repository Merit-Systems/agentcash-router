import type { NextResponse } from 'next/server';
import { invokeUnauthed } from '../flows/static/static-invoke.js';
import { finalize } from './finalize/index.js';
import { parseBody } from './parse-body.js';
import { runValidate } from './run-validate.js';
import type { FlowCtx } from './types.js';

/**
 * No-payment tail used by unprotected, apiKey-only, siwx-only flows, and the
 * paid+SIWX entitlement fast-path: parse body → validate → invoke → finalize.
 *
 * Streaming handlers are blocked at builder-registration time on any route
 * without `.paid({ dynamic: true })`, so this path only ever sees request-
 * shaped results. `invokeUnauthed` carries a defense-in-depth runtime guard.
 */
export async function runHandlerOnly(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
): Promise<NextResponse> {
  const body = await parseBody(ctx);
  if (!body.ok) return body.response;

  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) return validateErr;

  const result = await invokeUnauthed(ctx, wallet, account, body.data);
  return finalize(ctx, result.response, result.rawResult, body.data);
}
