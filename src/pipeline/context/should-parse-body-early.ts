import type { PricingStrategy } from '../../pricing/index.js';
import type { PaymentStrategy } from '../../protocols/index.js';
import type { RouteEntry } from '../../types.js';

/**
 * Decide whether to parse (and validate) the request body *before* issuing a
 * 402 challenge. This only matters on the unpaid/challenge path — once a
 * payment header is present, the full body parse + validate happens later as
 * part of the verified-payment flow.
 *
 * Returns true when all of the following hold:
 *   - No incoming payment strategy was matched (we're heading toward a 402).
 *   - The route declares a body schema (so there's something to parse).
 *   - Either:
 *       a) The pricer needs the body to compute its quote (dynamic / tiered
 *          pricing), so the 402 advertises a meaningful `maxAmountRequired`, OR
 *       b) The route has a `validateFn`, meaning the author wants bad input
 *          rejected up-front rather than after the caller has paid.
 *
 * If neither (a) nor (b) applies, the body parse is wasted work — the 402 is
 * generic and the caller can resend with payment.
 */
export function shouldParseBodyEarly(
  incomingStrategy: PaymentStrategy | null,
  routeEntry: RouteEntry,
  pricing: PricingStrategy | null,
): boolean {
  if (incomingStrategy) return false;
  if (!routeEntry.bodySchema) return false;
  return (pricing?.needsBody ?? false) || !!routeEntry.validateFn;
}
