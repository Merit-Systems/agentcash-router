import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bufferBody, MalformedJsonError, validateBody } from '../body.js';
import { firePluginResponse } from '../../plugin/events.js';
import type { FlowCtx, ParseBodyResult } from './types.js';

export async function parseBody(
  ctx: FlowCtx,
  request: NextRequest = ctx.request,
): Promise<ParseBodyResult> {
  if (!ctx.routeEntry.bodySchema) return { ok: true, data: undefined };
  let raw: unknown;
  try {
    raw = await bufferBody(request);
  } catch (err) {
    if (!(err instanceof MalformedJsonError)) throw err;
    const response = NextResponse.json(
      { success: false, error: 'Invalid JSON', issues: [] },
      { status: 400 },
    );
    firePluginResponse(ctx, response);
    return { ok: false, response };
  }
  const result = validateBody(raw, ctx.routeEntry.bodySchema);
  if (result.success) return { ok: true, data: result.data };
  const response = NextResponse.json(
    { success: false, error: result.error, issues: result.issues },
    { status: 400 },
  );
  firePluginResponse(ctx, response);
  return { ok: false, response };
}
