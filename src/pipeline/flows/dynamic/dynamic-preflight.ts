import type { PaymentStrategy } from '../../../protocols/types.js';
import type { RouteEntry } from '../../../types.js';

export async function resolveDynamicPreflight(
  strategy: PaymentStrategy,
  request: Request,
  routeEntry: RouteEntry,
): Promise<{ skipBody: boolean; skipHandler: boolean }> {
  const outcome = (await strategy.preflight?.(request, routeEntry)) ?? null;
  return {
    skipBody: outcome?.skipBody ?? false,
    skipHandler: outcome?.skipHandler ?? false,
  };
}
