/**
 * Response emission. Every response a flow returns funnels through `fail`
 * (error envelope + plugin events) or `finalize` (success path: provider
 * quota + plugin events). `protocolInitError` formats the 500 body for
 * payment-protocol init failures surfaced at request time.
 */
import { firePluginResponse, fireProviderQuota, type PluginFailure } from '../../plugin/events.js';
import type { RouteEntry } from '../../types.js';
import { applyNextSteps } from '../next-step.js';
import type { FlowCtx, RouterDeps } from './types.js';

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

export function finalize(
  ctx: FlowCtx,
  response: Response,
  rawResult: unknown,
  requestBody?: unknown,
  failure?: PluginFailure,
): Response {
  const next = applyNextSteps(ctx, response, rawResult, requestBody);
  fireProviderQuota(ctx, next.response, next.rawResult);
  firePluginResponse(ctx, next.response, requestBody, next.rawResult, failure);
  return next.response;
}

export function protocolInitError(routeEntry: RouteEntry, deps: RouterDeps): string | null {
  if (!routeEntry.pricing) return null;

  const errors: string[] = [];
  for (const protocol of routeEntry.protocols) {
    if (protocol === 'x402' && deps.x402InitError) {
      errors.push(`x402: ${deps.x402InitError}`);
    }
    if (protocol === 'mpp' && deps.mppInitError) {
      errors.push(`mpp: ${deps.mppInitError}`);
    }
  }

  if (errors.length === 0) return null;
  return `Payment protocol initialization failed. ${errors.join('; ')}`;
}
