import type { PaymentStrategy } from '../../../protocols/types.js';
import type { RouteEntry } from '../../../types.js';

export function resolveDynamicPreflight(
  strategy: PaymentStrategy,
  request: Request,
  routeEntry: RouteEntry,
): { skipBody: boolean; skipHandler: boolean } {
  const outcome = strategy.preflight?.(request, routeEntry) ?? null;
  return {
    skipBody: outcome?.skipBody ?? false,
    skipHandler: outcome?.skipHandler ?? false,
  };
}
