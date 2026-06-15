import type { PricingStrategy } from '../../pricing/index.js';
import type { PaymentStrategy } from '../../protocols/index.js';
import type { RouteEntry } from '../../types.js';

export function shouldParseBodyEarly(
  incomingStrategy: PaymentStrategy | null,
  routeEntry: RouteEntry,
  pricing: PricingStrategy | null,
): boolean {
  if (incomingStrategy) return false;
  if (!routeEntry.bodySchema) return false;
  return (pricing?.needsBody ?? false) || !!routeEntry.validateFn || !!routeEntry.checkoutSession;
}
