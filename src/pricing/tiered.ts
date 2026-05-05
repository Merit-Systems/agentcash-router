import type { TierConfig } from '../types.js';
import type { PricingDescriptor, PricingStrategy } from './types.js';

interface TieredPricingOptions {
  field: string;
  tiers: Record<string, TierConfig>;
  default?: string;
  maxPrice?: string;
  minPrice?: string;
}

export class TieredPricing implements PricingStrategy {
  readonly needsBody = true;

  constructor(private readonly opts: TieredPricingOptions) {}

  async quote(body: unknown): Promise<string> {
    const { field, tiers, default: defaultTier } = this.opts;
    const tierKey = body != null ? String((body as Record<string, unknown>)[field] ?? '') : '';

    if (tierKey && tiers[tierKey]) return tiers[tierKey].price;
    if (defaultTier && tiers[defaultTier]) return tiers[defaultTier].price;
    if (!tierKey) {
      throw httpError(400, `Missing required field '${field}' for tier pricing`);
    }
    throw httpError(
      400,
      `Unknown tier '${tierKey}' for field '${field}'. Valid tiers: ${Object.keys(tiers).join(', ')}`,
    );
  }

  challengeQuote(body: unknown | undefined): Promise<string> {
    if (body !== undefined) {
      try {
        return this.quote(body);
      } catch {
        // Fall through to max
      }
    }
    return Promise.resolve(this.maxTierPrice());
  }

  describe(): PricingDescriptor {
    return {
      mode: 'tiered',
      tiers: Object.entries(this.opts.tiers).map(([key, tier]) => ({
        key,
        price: tier.price,
        ...(tier.label !== undefined ? { label: tier.label } : {}),
      })),
      ...(this.opts.default !== undefined ? { default: this.opts.default } : {}),
    };
  }

  private maxTierPrice(): string {
    let max = '0';
    for (const tier of Object.values(this.opts.tiers)) {
      if (parseFloat(tier.price) > parseFloat(max)) max = tier.price;
    }
    return max;
  }
}

function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}
