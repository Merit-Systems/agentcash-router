import type { NextRequest, NextResponse } from 'next/server';
import type { HandlerContext, RouteEntry, StreamingHandlerContext } from './types.js';
import { preflight, type RouterDeps } from './pipeline/context/index.js';
import { runApiKeyOnlyFlow } from './pipeline/flows/api-key-only.js';
import { runPaidFlow } from './pipeline/flows/paid.js';
import { runSiwxOnlyFlow } from './pipeline/flows/siwx-only.js';
import { runUnprotectedFlow } from './pipeline/flows/unprotected.js';

/** @deprecated alias kept for downstream consumers; use `RouterDeps`. */
export type OrchestrateDeps = RouterDeps;
export type { RouterDeps } from './pipeline/context/index.js';

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

    if (routeEntry.authMode === 'unprotected') return runUnprotectedFlow(ctx);
    if (routeEntry.authMode === 'siwx') return runSiwxOnlyFlow(ctx);
    if (routeEntry.pricing) return runPaidFlow(ctx);
    if (routeEntry.apiKeyResolver) return runApiKeyOnlyFlow(ctx);
    return runUnprotectedFlow(ctx);
  };
}
