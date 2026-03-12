import { describe, expect, it } from 'vitest';
import { createRedisEntitlementStore, MemoryEntitlementStore } from '../src/auth/entitlement.js';

describe('MemoryEntitlementStore', () => {
  it('grants and checks entitlements by route + wallet', async () => {
    const store = new MemoryEntitlementStore();
    await store.grant('route/a', '0xWalletA');

    expect(await store.has('route/a', '0xwalleta')).toBe(true);
    expect(await store.has('route/b', '0xwalleta')).toBe(false);
    expect(await store.has('route/a', '0xwalletb')).toBe(false);
  });

  it('preserves Solana base58 address case', async () => {
    const store = new MemoryEntitlementStore();
    const solanaAddr = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
    await store.grant('route/a', solanaAddr);

    expect(await store.has('route/a', solanaAddr)).toBe(true);
    expect(await store.has('route/a', solanaAddr.toLowerCase())).toBe(false);
  });
});

describe('createRedisEntitlementStore', () => {
  it('supports upstash-style clients', async () => {
    const data = new Map<string, Set<string>>();
    const upstash = {
      constructor: { name: 'Redis' },
      url: 'https://example.com',
      async sadd(key: string, member: string): Promise<number> {
        let set = data.get(key);
        if (!set) {
          set = new Set<string>();
          data.set(key, set);
        }
        set.add(member);
        return 1;
      },
      async sismember(key: string, member: string): Promise<number> {
        return data.get(key)?.has(member) ? 1 : 0;
      },
    };

    const store = createRedisEntitlementStore(upstash);
    await store.grant('route/a', '0xWalletA');
    expect(await store.has('route/a', '0xwalleta')).toBe(true);
    expect(await store.has('route/a', '0xwalletb')).toBe(false);
  });

  it('supports ioredis-style clients', async () => {
    const data = new Map<string, Set<string>>();
    const ioredis = {
      options: {},
      status: 'ready',
      async sadd(key: string, member: string): Promise<number> {
        let set = data.get(key);
        if (!set) {
          set = new Set<string>();
          data.set(key, set);
        }
        set.add(member);
        return 1;
      },
      async sismember(key: string, member: string): Promise<number> {
        return data.get(key)?.has(member) ? 1 : 0;
      },
    };

    const store = createRedisEntitlementStore(ioredis);
    await store.grant('route/b', '0xWalletB');
    expect(await store.has('route/b', '0xwalletb')).toBe(true);
  });
});
