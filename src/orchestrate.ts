import type { NextRequest, NextResponse } from 'next/server';
import type { HandlerContext, RouteEntry } from './types.js';
import { preflight, type RouterDeps } from './pipeline/context/index.js';
import { runApiKeyOnlyFlow } from './pipeline/flows/api-key-only.js';
import { runPaidFlow } from './pipeline/flows/paid.js';
import { runSiwxOnlyFlow } from './pipeline/flows/siwx-only.js';
import { runUnprotectedFlow } from './pipeline/flows/unprotected.js';

/** @deprecated alias kept for downstream consumers; use `RouterDeps`. */
export type OrchestrateDeps = RouterDeps;
export type { RouterDeps } from './pipeline/context/index.js';

/**
 * Compile a route registration into a Next.js request handler.
 *
 * The dispatcher picks one of four flows based on the route shape:
 *   - unprotected:           no auth, no payment
 *   - apiKey-only:           static API key, no payment
 *   - siwx-only:             pure wallet identity, no payment
 *   - paid:                  any pricing — also handles optional apiKey gate
 *                            and SIWX entitlement fast-path
 *
 * Each flow is self-contained in `pipeline/flows/`. The protocol-specific bits
 * (verify, settle, challenge construction) are in `protocols/{x402,mpp}/` behind
 * the `PaymentStrategy` interface.
 */
export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: (ctx: HandlerContext) => Promise<unknown>,
  deps: RouterDeps,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    await deps.initPromise;
    const ctx = preflight(routeEntry, handler, deps, request);

    if (routeEntry.authMode === 'unprotected') return runUnprotectedFlow(ctx);
    // Pure SIWX takes precedence over pricing — authMode='siwx' is identity-only,
    // any pricing field on the route is ignored (matches pre-refactor behavior).
    if (routeEntry.authMode === 'siwx') return runSiwxOnlyFlow(ctx);
    if (routeEntry.pricing) return runPaidFlow(ctx);
    if (routeEntry.apiKeyResolver) return runApiKeyOnlyFlow(ctx);
    return runUnprotectedFlow(ctx);
  };
}
