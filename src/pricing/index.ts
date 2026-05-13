import { DynamicPricing, type DynamicPricingFn } from './dynamic.js';
import { FixedPricing } from './fixed.js';
import { TieredPricing } from './tiered.js';
import type { PricingDeps, PricingStrategy, RawPricingConfig } from './types.js';

export { FixedPricing } from './fixed.js';
export { DynamicPricing } from './dynamic.js';
export { TieredPricing } from './tiered.js';
export type { PricingStrategy, RawPricingConfig, PricingDeps } from './types.js';

export function selectPricing(
  raw: RawPricingConfig | undefined,
  deps: PricingDeps = {},
): PricingStrategy | null {
  if (raw == null) return null;

  if (typeof raw === 'string') {
    return new FixedPricing(raw);
  }

  if (typeof raw === 'function') {
    return new DynamicPricing({
      fn: raw as DynamicPricingFn,
      maxPrice: deps.maxPrice,
      minPrice: deps.minPrice,
      route: deps.route,
      alert: deps.alert,
    });
  }

  if (typeof raw === 'object' && 'tiers' in raw) {
    return new TieredPricing({
      field: raw.field,
      tiers: raw.tiers,
      default: raw.default,
      maxPrice: deps.maxPrice,
      minPrice: deps.minPrice,
    });
  }

  throw new Error(`Unknown pricing config: ${JSON.stringify(raw)}`);
}
