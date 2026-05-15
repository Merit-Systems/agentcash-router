import { describe, it, expect } from 'vitest';
import {
  selectPricing,
  FixedPricing,
  DynamicPricing,
  TieredPricing,
} from '../src/pricing/index.js';
import { compareDecimals, decimalToAtomic, isPositiveDecimal } from '../src/pricing/format.js';
import { HttpError } from '../src/types.js';

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

  it('propagates an HttpError instead of falling back to maxPrice', async () => {
    const p = new DynamicPricing({
      fn: () => {
        throw new HttpError('blocked', 400);
      },
      maxPrice: '0.50',
    });
    await expect(p.quote({})).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
    });
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

  it('throws 500 when fn returns a malformed amount and no maxPrice', async () => {
    const p = new DynamicPricing({ fn: () => 'not-a-price', route: 'test/route' });
    await expect(p.quote({})).rejects.toMatchObject({ name: 'HttpError', status: 500 });
  });

  it('throws 500 when fn returns a non-positive amount and no maxPrice', async () => {
    const p = new DynamicPricing({ fn: () => '0', route: 'test/route' });
    await expect(p.quote({})).rejects.toMatchObject({ status: 500 });
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

  it('challengeQuote falls back to max tier when body lacks the discriminator field', async () => {
    const p = new TieredPricing({ field: 'tier', tiers });
    expect(await p.challengeQuote({})).toBe('2.00');
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

describe('decimal formatting boundaries', () => {
  it('rejects scientific notation', () => {
    expect(() => decimalToAtomic('1e-7')).toThrow();
    expect(isPositiveDecimal('1e-7')).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(decimalToAtomic('  1  ')).toBe(1_000_000n);
    expect(compareDecimals('  1  ', '1.00')).toBe(0);
  });

  it('rejects fractions beyond USDC decimal places', () => {
    expect(() => decimalToAtomic('0.0000001')).toThrow();
    expect(isPositiveDecimal('0.0000001')).toBe(false);
  });

  it('compares decimals precisely without float drift', () => {
    expect(compareDecimals('0.3', '0.30000')).toBe(0);
    expect(compareDecimals('0.1', '0.2')).toBe(-1);
    expect(compareDecimals('0.000001', '0.000002')).toBe(-1);
  });

  it('caps dynamic pricing using bigint comparison (not float)', async () => {
    const p = new DynamicPricing({
      fn: () => '0.000001',
      maxPrice: '1.00',
    });
    expect(await p.quote({})).toBe('0.000001');
  });

  it('caps malformed dynamic price strings to maxPrice', async () => {
    const alerts: Array<{ level: string; message: string }> = [];
    const p = new DynamicPricing({
      fn: () => '1e-7',
      maxPrice: '1.00',
      alert: (level, message) => alerts.push({ level, message }),
    });
    expect(await p.quote({})).toBe('1.00');
    expect(alerts.find((a) => a.level === 'warn')).toBeDefined();
  });

  it('selects highest tier via bigint comparison', async () => {
    const p = new TieredPricing({
      field: 'tier',
      tiers: {
        a: { price: '0.000001' },
        b: { price: '0.000010' },
        c: { price: '0.000005' },
      },
    });
    expect(await p.challengeQuote(undefined)).toBe('0.000010');
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
