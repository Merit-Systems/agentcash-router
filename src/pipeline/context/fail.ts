import { NextResponse } from 'next/server';
import { firePluginResponse } from './fire-plugin-response.js';
import type { FlowCtx } from './types.js';

/** Build a JSON error response and fire the plugin onResponse hook. */
export function fail(
  ctx: FlowCtx,
  status: number,
  message: string,
  requestBody?: unknown,
): NextResponse {
  const response = NextResponse.json({ success: false, error: message }, { status });
  firePluginResponse(ctx, response, requestBody);
  return response;
}
