import type { TierConfig } from '../types.js';
import { compareDecimals } from './format.js';
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

    // Own-property lookup only: the key is attacker-controlled, and a plain
    // index would walk the prototype chain (`tier: "constructor"`).
    if (tierKey && Object.hasOwn(tiers, tierKey)) return tiers[tierKey].price;
    if (defaultTier && Object.hasOwn(tiers, defaultTier)) return tiers[defaultTier].price;
    if (!tierKey) {
      throw httpError(400, `Missing required field '${field}' for tier pricing`);
    }
    throw httpError(
      400,
      `Unknown tier '${tierKey}' for field '${field}'. Valid tiers: ${Object.keys(tiers).join(', ')}`,
    );
  }

  async challengeQuote(body: unknown | undefined): Promise<string> {
    if (body !== undefined) {
      try {
        return await this.quote(body);
      } catch {
        /* fall through to max */
      }
    }
    return this.maxTierPrice();
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
      if (compareDecimals(tier.price, max) > 0) max = tier.price;
    }
    return max;
  }
}

function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}
