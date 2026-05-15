import { HttpError, type AlertFn } from '../types.js';
import { compareDecimals } from './format.js';
import type { PricingDescriptor, PricingStrategy } from './types.js';

export type DynamicPricingFn = (body: unknown) => string | Promise<string>;

interface DynamicPricingOptions {
  fn: DynamicPricingFn;
  maxPrice?: string;
  minPrice?: string;
  route?: string;
  alert?: AlertFn;
}

export class DynamicPricing implements PricingStrategy {
  readonly needsBody = true;

  constructor(private readonly opts: DynamicPricingOptions) {}

  async quote(body: unknown): Promise<string> {
    try {
      const raw = await this.opts.fn(body);
      return this.cap(raw, body);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      this.alert('error', `Pricing function failed: ${msg(err)}`, {
        error: err instanceof Error ? err.stack : String(err),
        body,
      });
      if (this.opts.maxPrice) {
        this.alert('warn', `Using maxPrice ${this.opts.maxPrice} as fallback after pricing error`);
        return this.opts.maxPrice;
      }
      throw err;
    }
  }

  challengeQuote(body: unknown | undefined): Promise<string> {
    if (body === undefined) return Promise.resolve(this.opts.maxPrice ?? '0');
    return this.quote(body);
  }

  describe(): PricingDescriptor {
    return {
      mode: 'dynamic',
      min: this.opts.minPrice ?? '0',
      max: this.opts.maxPrice ?? '0',
    };
  }

  private cap(raw: string, body: unknown): string {
    if (!this.opts.maxPrice) return raw;
    let overCap: boolean;
    try {
      overCap = compareDecimals(raw, this.opts.maxPrice) > 0;
    } catch {
      overCap = true;
    }
    if (overCap) {
      this.alert('warn', `Price ${raw} exceeds maxPrice ${this.opts.maxPrice}, capping`, {
        calculated: raw,
        maxPrice: this.opts.maxPrice,
        body,
      });
      return this.opts.maxPrice;
    }
    return raw;
  }

  private alert(
    level: 'info' | 'warn' | 'error' | 'critical',
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.opts.alert?.(level, message, meta);
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
