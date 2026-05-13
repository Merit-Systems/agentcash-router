import type { RouteEntry } from '../../types.js';
import type { RouterDeps } from './types.js';

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
