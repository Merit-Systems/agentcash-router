import type { NextResponse } from 'next/server';
import { firePluginResponse } from '../fire-plugin-response.js';
import { fireProviderQuota } from '../fire-provider-quota.js';
import type { FlowCtx } from '../types.js';

export function finalize(
  ctx: FlowCtx,
  response: NextResponse,
  rawResult: unknown,
  requestBody?: unknown,
): NextResponse {
  fireProviderQuota(ctx, response, rawResult);
  firePluginResponse(ctx, response, requestBody, rawResult);
  return response;
}
