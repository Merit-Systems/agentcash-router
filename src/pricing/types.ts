import type { AlertFn, TierConfig } from '../types.js';

export type PricingDescriptor =
  | { mode: 'fixed'; amount: string }
  | { mode: 'dynamic'; min: string; max: string }
  | {
      mode: 'tiered';
      tiers: Array<{ key: string; price: string; label?: string }>;
      default?: string;
    };

export interface PricingStrategy {
  /** Whether quote() requires the parsed body. Drives early-parse decision. */
  readonly needsBody: boolean;

  /** Resolve the actual price for a verified payment. */
  quote(body: unknown): Promise<string>;

  /**
   * Resolve the price to advertise in a 402 challenge. `body` is undefined when
   * early-parsing was skipped or failed; strategies that need body data should
   * fall back to maxPrice or '0' in that case.
   */
  challengeQuote(body: unknown | undefined): Promise<string>;

  /** Static description used by discovery (OpenAPI, x-payment-info). */
  describe(): PricingDescriptor;
}

export type RawPricingConfig =
  | string
  | ((body: unknown) => string | Promise<string>)
  | { field: string; tiers: Record<string, TierConfig>; default?: string };

export interface PricingDeps {
  /** Optional plugin alert hook. Strategies use this for cap warnings and pricing-fn errors. */
  alert?: AlertFn;
  /** Optional max price ceiling, applies to dynamic/tiered. */
  maxPrice?: string;
  /** Optional minimum price floor, used in describe() output. */
  minPrice?: string;
  /** Route key, used in alerts. */
  route?: string;
}
