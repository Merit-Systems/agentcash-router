import { NextResponse } from 'next/server';
import { firePluginResponse } from '../../plugin/events.js';
import type { FlowCtx } from './types.js';

export function fail(
  ctx: FlowCtx,
  status: number,
  message: string,
  requestBody?: unknown,
): NextResponse {
  const responseBody = { success: false, error: message };
  const response = NextResponse.json(responseBody, { status });
  firePluginResponse(ctx, response, requestBody, responseBody, { message });
  return response;
}
