import type { HandlerContext, RouteEntry, StreamingHandlerContext } from '../types.js';
import { preflight, validateQuery, type RouterDeps } from './steps/index.js';
import { selectIncomingStrategy } from '../protocols/index.js';
import { detectProtocol } from '../protocols/detect.js';
import { HEADERS } from '../headers.js';
import { runApiKeyOnlyFlow } from './flows/api-key-only.js';
import { runPaidFlow } from './flows/paid.js';
import { runSiwxOnlyFlow } from './flows/siwx-only.js';
import { runUnprotectedFlow } from './flows/unprotected.js';

export type { RouterDeps } from './steps/index.js';

export type RouteHandler =
  | ((ctx: HandlerContext) => Promise<unknown>)
  | ((ctx: StreamingHandlerContext) => AsyncIterable<unknown>);

function shouldSkipQueryValidation(routeEntry: RouteEntry, request: Request): boolean {
  // Paid routes: skip when no payment header (bare probe → 402 payment challenge).
  if (routeEntry.pricing || routeEntry.authMode === 'paid') {
    return selectIncomingStrategy(request, routeEntry.protocols) === null;
  }
  // SIWX routes: skip when no SIWX header and no MPP credential (bare probe → 402 SIWX challenge).
  if (routeEntry.authMode === 'siwx') {
    return !request.headers.get(HEADERS.SIWX) && detectProtocol(request) !== 'mpp';
  }
  // Unprotected / apiKey: always validate (no challenge to issue).
  return false;
}

export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: RouteHandler,
  deps: RouterDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    await deps.initPromise;
    const ctx = preflight(routeEntry, handler, deps, request);

    if (!shouldSkipQueryValidation(routeEntry, request)) {
      const query = validateQuery(ctx);
      if (!query.ok) return query.response;
      ctx.query = query.data;
    }

    if (routeEntry.authMode === 'unprotected') return runUnprotectedFlow(ctx);
    if (routeEntry.authMode === 'siwx') return runSiwxOnlyFlow(ctx);
    if (routeEntry.pricing) return runPaidFlow(ctx);
    if (routeEntry.apiKeyResolver) return runApiKeyOnlyFlow(ctx);
    return runUnprotectedFlow(ctx);
  };
}
