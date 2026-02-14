import { describe, it, expect } from 'vitest';
import { resolvePrice, resolveMaxPrice } from '../src/pricing.js';

describe('static pricing', () => {
  it('resolves string price as-is', async () => {
    expect(await resolvePrice('0.02')).toBe('0.02');
  });
});

describe('dynamic pricing', () => {
  it('calls price function with parsed body', async () => {
    const fn = (body: { size: number }) => (body.size * 0.01).toFixed(2);
    expect(await resolvePrice(fn, { size: 5 })).toBe('0.05');
  });

  it('supports async price functions', async () => {
    const fn = async (body: { tier: string }) => (body.tier === 'pro' ? '1.00' : '0.50');
    expect(await resolvePrice(fn, { tier: 'pro' })).toBe('1.00');
  });
});

describe('tiered pricing', () => {
  const tiers = {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
    '1gb': { price: '2.00', label: '1 GB' },
  };

  it('resolves tier from body field', async () => {
    const pricing = { field: 'tier', tiers };
    expect(await resolvePrice(pricing, { tier: '100mb' })).toBe('0.20');
  });

  it('uses highest tier price in resolveMaxPrice', () => {
    const pricing = { field: 'tier', tiers };
    expect(resolveMaxPrice(pricing)).toBe('2.00');
  });

  it('rejects unknown tier key with 400', async () => {
    const pricing = { field: 'tier', tiers };
    await expect(resolvePrice(pricing, { tier: 'unknown' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('uses default tier when field missing', async () => {
    const pricing = { field: 'tier', tiers, default: '10mb' };
    expect(await resolvePrice(pricing, {})).toBe('0.02');
  });

  it('rejects when no tier and no default', async () => {
    const pricing = { field: 'tier', tiers };
    await expect(resolvePrice(pricing, {})).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('resolveMaxPrice', () => {
  it('returns static price as-is', () => {
    expect(resolveMaxPrice('0.05')).toBe('0.05');
  });

  it('throws for dynamic pricing (needs maxPrice from route)', () => {
    expect(() => resolveMaxPrice((body: unknown) => '0.01')).toThrow();
  });
});
