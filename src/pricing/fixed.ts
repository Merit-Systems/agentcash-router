import type { PricingDescriptor, PricingStrategy } from './types.js';

export class FixedPricing implements PricingStrategy {
  readonly needsBody = false;

  constructor(private readonly price: string) {}

  quote(): Promise<string> {
    return Promise.resolve(this.price);
  }

  challengeQuote(): Promise<string> {
    return Promise.resolve(this.price);
  }

  describe(): PricingDescriptor {
    return { mode: 'fixed', amount: this.price };
  }
}
