import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bufferBody, validateBody } from '../../body.js';
import { firePluginResponse } from './fire-plugin-response.js';
import type { FlowCtx, ParseBodyResult } from './types.js';

/**
 * Parse and validate the request body against `routeEntry.bodySchema`. On
 * failure, fires the `onResponse` plugin hook before returning so callers
 * don't have to remember (matches the `fail()` helper's contract).
 *
 * `request` is optional — when omitted, parses `ctx.request`. Callers pass
 * a cloned request when they need to read the body again later (e.g.
 * pre-challenge early parse, then re-parse after verify).
 */
export async function parseBody(
  ctx: FlowCtx,
  request: NextRequest = ctx.request,
): Promise<ParseBodyResult> {
  if (!ctx.routeEntry.bodySchema) return { ok: true, data: undefined };
  const raw = await bufferBody(request);
  const result = validateBody(raw, ctx.routeEntry.bodySchema);
  if (result.success) return { ok: true, data: result.data };
  const response = NextResponse.json(
    { success: false, error: result.error, issues: result.issues },
    { status: 400 },
  );
  firePluginResponse(ctx, response);
  return { ok: false, response };
}
