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
  readonly needsBody: boolean;

  quote(body: unknown): Promise<string>;

  challengeQuote(body: unknown | undefined): Promise<string>;

  describe(): PricingDescriptor;
}

export type RawPricingConfig =
  | string
  | ((body: unknown) => string | Promise<string>)
  | { field: string; tiers: Record<string, TierConfig>; default?: string };

export interface PricingDeps {
  alert?: AlertFn;
  maxPrice?: string;
  minPrice?: string;
  route?: string;
}
