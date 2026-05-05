import type { NextResponse } from 'next/server';
import { firePluginHook } from '../../plugin.js';
import type { FlowCtx } from './types.js';

export function firePluginResponse(
  ctx: FlowCtx,
  response: NextResponse,
  requestBody?: unknown,
  responseBody?: unknown,
): void {
  firePluginHook(ctx.deps.plugin, 'onResponse', ctx.pluginCtx, {
    statusCode: response.status,
    statusText: response.statusText,
    duration: Date.now() - ctx.meta.startTime,
    contentType: response.headers.get('content-type'),
    headers: Object.fromEntries(response.headers.entries()),
    requestBody,
    responseBody,
  });

  // 402 is a payment challenge, not an error
  if (response.status >= 400 && response.status !== 402) {
    firePluginHook(ctx.deps.plugin, 'onError', ctx.pluginCtx, {
      status: response.status,
      message: response.statusText || `HTTP ${response.status}`,
      settled: false,
    });
  }
}
