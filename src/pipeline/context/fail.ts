import { NextResponse } from 'next/server';
import { firePluginResponse } from '../../plugin/events.js';
import type { FlowCtx } from './types.js';

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
