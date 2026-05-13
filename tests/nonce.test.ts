import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryNonceStore,
  createKvNonceStore,
  type KvStore,
  SIWX_CHALLENGE_EXPIRY_MS,
} from '../src/kv-store/index.js';

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
    vi.advanceTimersByTime(SIWX_CHALLENGE_EXPIRY_MS + 1);
    expect(await store.check('nonce-1')).toBe(true);
  });

  it('evicts expired entries on check', async () => {
    const store = new MemoryNonceStore();
    await store.check('old-nonce');
    vi.advanceTimersByTime(SIWX_CHALLENGE_EXPIRY_MS + 1);
    await store.check('new-nonce');
    expect(await store.check('old-nonce')).toBe(true);
    expect(await store.check('new-nonce')).toBe(false);
  });
});

describe('createKvNonceStore', () => {
  function makeFakeKv(): KvStore & { setNxExCalls: Array<[string, unknown, number]> } {
    const data = new Map<string, unknown>();
    const calls: Array<[string, unknown, number]> = [];
    return {
      setNxExCalls: calls,
      async get(key) {
        return data.get(key) ?? null;
      },
      async set(key, value) {
        data.set(key, value);
      },
      async del(key) {
        data.delete(key);
      },
      async setNxEx(key, value, ttl) {
        calls.push([key, value, ttl]);
        if (data.has(key)) return false;
        data.set(key, value);
        return true;
      },
      async sadd() {
        throw new Error('not used');
      },
      async sismember() {
        throw new Error('not used');
      },
      async update() {
        throw new Error('not used');
      },
    };
  }

  it('first use returns true, second returns false', async () => {
    const kv = makeFakeKv();
    const store = createKvNonceStore(kv);
    expect(await store.check('nonce-1')).toBe(true);
    expect(await store.check('nonce-1')).toBe(false);
  });

  it('uses default prefix and 5min TTL', async () => {
    const kv = makeFakeKv();
    const store = createKvNonceStore(kv);
    await store.check('abc');
    expect(kv.setNxExCalls[0]).toEqual(['siwx:nonce:abc', 1, 300]);
  });

  it('respects custom prefix and ttlMs', async () => {
    const kv = makeFakeKv();
    const store = createKvNonceStore(kv, { prefix: 'app:n:', ttlMs: 60_000 });
    await store.check('abc');
    expect(kv.setNxExCalls[0]).toEqual(['app:n:abc', 1, 60]);
  });
});
