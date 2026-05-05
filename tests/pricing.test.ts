import { describe, it, expect } from 'vitest';
import {
  selectPricing,
  FixedPricing,
  DynamicPricing,
  TieredPricing,
} from '../src/pricing/index.js';

describe('FixedPricing', () => {
  it('quote returns the configured price', async () => {
    const p = new FixedPricing('0.02');
    expect(await p.quote(undefined)).toBe('0.02');
  });

  it('challengeQuote returns the same price', async () => {
    const p = new FixedPricing('0.05');
    expect(await p.challengeQuote(undefined)).toBe('0.05');
  });

  it('describes itself as fixed', () => {
    expect(new FixedPricing('0.02').describe()).toEqual({ mode: 'fixed', amount: '0.02' });
  });
});

describe('DynamicPricing', () => {
  it('calls the price function with parsed body', async () => {
    const p = new DynamicPricing({
      fn: (body) => ((body as { size: number }).size * 0.01).toFixed(2),
    });
    expect(await p.quote({ size: 5 })).toBe('0.05');
  });

  it('supports async price functions', async () => {
    const p = new DynamicPricing({
      fn: async (body) => ((body as { tier: string }).tier === 'pro' ? '1.00' : '0.50'),
    });
    expect(await p.quote({ tier: 'pro' })).toBe('1.00');
  });

  it('caps at maxPrice when fn returns above max', async () => {
    const alerts: Array<{ level: string; message: string }> = [];
    const p = new DynamicPricing({
      fn: () => '5.00',
      maxPrice: '1.00',
      alert: (level, message) => alerts.push({ level, message }),
    });
    expect(await p.quote({})).toBe('1.00');
    expect(alerts.find((a) => a.level === 'warn')).toBeDefined();
  });

  it('falls back to maxPrice when fn throws', async () => {
    const p = new DynamicPricing({
      fn: () => {
        throw new Error('oops');
      },
      maxPrice: '0.50',
    });
    expect(await p.quote({})).toBe('0.50');
  });

  it('rethrows when fn throws and no maxPrice fallback', async () => {
    const p = new DynamicPricing({
      fn: () => {
        throw new Error('oops');
      },
    });
    await expect(p.quote({})).rejects.toThrow('oops');
  });

  it('challengeQuote returns maxPrice when body is undefined', async () => {
    const p = new DynamicPricing({ fn: () => '0.10', maxPrice: '0.99' });
    expect(await p.challengeQuote(undefined)).toBe('0.99');
  });

  it('challengeQuote uses live price when body is present', async () => {
    const p = new DynamicPricing({ fn: () => '0.10', maxPrice: '0.99' });
    expect(await p.challengeQuote({})).toBe('0.10');
  });

  it('describes itself as dynamic with min/max', () => {
    const p = new DynamicPricing({ fn: () => '0', minPrice: '0.01', maxPrice: '5.00' });
    expect(p.describe()).toEqual({ mode: 'dynamic', min: '0.01', max: '5.00' });
  });
});

describe('TieredPricing', () => {
  const tiers = {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
    '1gb': { price: '2.00', label: '1 GB' },
  };

  it('resolves tier from body field', async () => {
    const p = new TieredPricing({ field: 'tier', tiers });
    expect(await p.quote({ tier: '100mb' })).toBe('0.20');
  });

  it('challengeQuote returns highest tier price when body absent', async () => {
    const p = new TieredPricing({ field: 'tier', tiers });
    expect(await p.challengeQuote(undefined)).toBe('2.00');
  });

  it('rejects unknown tier with status 400', async () => {
    const p = new TieredPricing({ field: 'tier', tiers });
    await expect(p.quote({ tier: 'unknown' })).rejects.toMatchObject({ status: 400 });
  });

  it('uses default tier when field missing', async () => {
    const p = new TieredPricing({ field: 'tier', tiers, default: '10mb' });
    expect(await p.quote({})).toBe('0.02');
  });

  it('rejects when no tier and no default', async () => {
    const p = new TieredPricing({ field: 'tier', tiers });
    await expect(p.quote({})).rejects.toMatchObject({ status: 400 });
  });
});

describe('selectPricing', () => {
  it('returns null for null/undefined', () => {
    expect(selectPricing(undefined)).toBeNull();
  });

  it('returns FixedPricing for string', () => {
    expect(selectPricing('0.02')).toBeInstanceOf(FixedPricing);
  });

  it('returns DynamicPricing for function', () => {
    expect(selectPricing(() => '0.01')).toBeInstanceOf(DynamicPricing);
  });

  it('returns TieredPricing for tiered config', () => {
    expect(selectPricing({ field: 'tier', tiers: { a: { price: '0.01' } } })).toBeInstanceOf(
      TieredPricing,
    );
  });
});
