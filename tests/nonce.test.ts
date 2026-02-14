import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryNonceStore } from '../src/auth/nonce.js';

describe('MemoryNonceStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first use of nonce returns true', async () => {
    const store = new MemoryNonceStore();
    expect(await store.check('nonce-1')).toBe(true);
  });

  it('second use of same nonce returns false', async () => {
    const store = new MemoryNonceStore();
    await store.check('nonce-1');
    expect(await store.check('nonce-1')).toBe(false);
  });

  it('nonce accepted again after TTL expires', async () => {
    const store = new MemoryNonceStore();
    await store.check('nonce-1');
    // Advance past 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await store.check('nonce-1')).toBe(true);
  });

  it('evicts expired entries on check', async () => {
    const store = new MemoryNonceStore();
    await store.check('old-nonce');
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    // New check triggers eviction
    await store.check('new-nonce');
    // Old nonce should be evicted, new one should be tracked
    expect(await store.check('old-nonce')).toBe(true);
    expect(await store.check('new-nonce')).toBe(false);
  });
});
