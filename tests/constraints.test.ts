import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkSweepInvariant,
  checkAllRoutesReturn402,
  checkWalletBalance,
} from '../src/testing/constraints.js';
import type { RouteEntry } from '../src/types.js';

describe('checkSweepInvariant', () => {
  it('passes with valid config', () => {
    const result = checkSweepInvariant(10, 20);
    expect(result.passed).toBe(true);
    expect(result.name).toBe('sweep-invariant');
    expect(result.message).toContain('by construction');
  });

  it('passes with equal buffer and threshold', () => {
    const result = checkSweepInvariant(10, 10);
    expect(result.passed).toBe(true);
  });

  it('fails when buffer is zero', () => {
    const result = checkSweepInvariant(0, 20);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('> 0');
  });

  it('fails when buffer is negative', () => {
    const result = checkSweepInvariant(-1, 20);
    expect(result.passed).toBe(false);
  });

  it('fails when sweepThreshold < buffer', () => {
    const result = checkSweepInvariant(20, 10);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('>=');
  });
});

describe('checkAllRoutesReturn402', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns pass for routes returning 402', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('', { status: 402 }));

    const routes: RouteEntry[] = [
      { key: 'test', authMode: 'paid', method: 'GET', protocols: ['x402'] },
    ];
    const results = await checkAllRoutesReturn402(routes, 'http://localhost:3000');
    expect(results[0]?.passed).toBe(true);
  });

  it('returns fail for routes not returning 402', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('ok', { status: 200 }));

    const routes: RouteEntry[] = [
      { key: 'test', authMode: 'paid', method: 'GET', protocols: ['x402'] },
    ];
    const results = await checkAllRoutesReturn402(routes, 'http://localhost:3000');
    expect(results[0]?.passed).toBe(false);
  });

  it('skips non-paid routes', async () => {
    const routes: RouteEntry[] = [
      { key: 'free', authMode: 'unprotected', method: 'GET', protocols: [] },
    ];
    const results = await checkAllRoutesReturn402(routes, 'http://localhost:3000');
    expect(results).toHaveLength(0);
  });

  it('handles fetch errors', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network down'));

    const routes: RouteEntry[] = [
      { key: 'test', authMode: 'paid', method: 'POST', protocols: ['x402'] },
    ];
    const results = await checkAllRoutesReturn402(routes, 'http://localhost:3000');
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.message).toContain('network down');
  });
});

describe('checkWalletBalance', () => {
  it('passes when balance above threshold', async () => {
    const result = await checkWalletBalance(async () => 5.0, 1.0);
    expect(result.passed).toBe(true);
  });

  it('fails when balance below threshold', async () => {
    const result = await checkWalletBalance(async () => 0.1, 1.0);
    expect(result.passed).toBe(false);
  });

  it('handles balance check errors', async () => {
    const result = await checkWalletBalance(async () => {
      throw new Error('rpc fail');
    }, 1.0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('rpc fail');
  });
});
