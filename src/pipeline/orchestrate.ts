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

function shouldSkipQueryValidation(routeEntry: RouteEntry, request: NextRequest): boolean {
  const isPaidRoute = !!routeEntry.pricing || routeEntry.authMode === 'paid';
  if (!isPaidRoute) return false;
  return selectIncomingStrategy(request, routeEntry.protocols) === null;
}

export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: RouteHandler,
  deps: RouterDeps,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
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
