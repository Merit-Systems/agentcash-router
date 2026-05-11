import type { PaymentStrategy } from '../../../protocols/types.js';
import type { RouteEntry } from '../../../types.js';

/**
 * Resolves the strategy's preflight classification into orchestrator flags.
 * Returns `{ skipBody: false, skipHandler: false }` when the strategy doesn't
 * implement `preflight` or returns null. Callers must have already ruled out
 * the no-credential case — preflight has nothing to classify without one.
 */
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
