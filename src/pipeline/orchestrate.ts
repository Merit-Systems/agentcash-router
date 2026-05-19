import type { NextRequest, NextResponse } from 'next/server';
import type { HandlerContext, RouteEntry, StreamingHandlerContext } from '../types.js';
import { preflight, validateQuery, type RouterDeps } from './steps/index.js';
import { selectIncomingStrategy } from '../protocols/index.js';
import { runApiKeyOnlyFlow } from './flows/api-key-only.js';
import { runPaidFlow } from './flows/paid.js';
import { runSiwxOnlyFlow } from './flows/siwx-only.js';
import { runUnprotectedFlow } from './flows/unprotected.js';

export type { RouterDeps } from './steps/index.js';

export type RouteHandler =
  | ((ctx: HandlerContext) => Promise<unknown>)
  | ((ctx: StreamingHandlerContext) => AsyncIterable<unknown>);

export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: RouteHandler,
  deps: RouterDeps,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    await deps.initPromise;
    const ctx = preflight(routeEntry, handler, deps, request);

    // For paid routes with no payment header, skip query validation and let
    // the paid flow return the 402 challenge directly. This ensures x402scan
    // probes (bare requests with no payment) get a 402 instead of a 400
    // validation error from missing required query params.
    const isPaidRoute = !!routeEntry.pricing || routeEntry.authMode === 'paid';
    const hasPayment = isPaidRoute && selectIncomingStrategy(request, routeEntry.protocols) !== null;

    if (!isPaidRoute || hasPayment) {
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
