import {
  firePluginResponse,
  fireProviderQuota,
  type PluginFailure,
} from '../../../plugin/events.js';
import type { FlowCtx } from '../types.js';

export function finalize(
  ctx: FlowCtx,
  response: Response,
  rawResult: unknown,
  requestBody?: unknown,
  failure?: PluginFailure,
): Response {
  fireProviderQuota(ctx, response, rawResult);
  firePluginResponse(ctx, response, requestBody, rawResult, failure);
  return response;
}
