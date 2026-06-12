import { firePluginResponse, type PluginFailure } from '../../plugin/events.js';
import type { FlowCtx } from './types.js';

export function fail(
  ctx: FlowCtx,
  status: number,
  message: string,
  requestBody?: unknown,
  failure?: PluginFailure,
): Response {
  const responseBody = { success: false, error: message };
  const response = Response.json(responseBody, { status });
  firePluginResponse(ctx, response, requestBody, responseBody, {
    ...failure,
    message: failure?.message ?? message,
  });
  return response;
}
