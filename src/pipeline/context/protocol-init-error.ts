import type { RouteEntry } from '../../types.js';
import type { RouterDeps } from './types.js';

/**
 * Collect per-protocol initialization failures for a route into a single
 * human-readable error message.
 *
 * Returns `null` when the route is safe to challenge with a 402 — i.e. either
 * the route has no pricing (no payment will ever be requested), or every
 * payment protocol enabled on the route initialized cleanly at boot.
 *
 * Returns a non-null message when issuing a 402 would be misleading, because
 * one or more of the route's protocols failed to initialize (e.g. missing
 * facilitator config, bad RPC URL). In that case the caller should reply
 * 500 with this message instead of advertising a payment challenge the
 * server can't actually settle.
 */
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
