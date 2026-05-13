import { describe, expect, it } from 'vitest';
import {
  createKvEntitlementStore,
  MemoryEntitlementStore,
  type KvStore,
} from '../src/kv-store/index.js';

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

  it('canonicalizes uppercase EVM prefixes without touching Solana casing', async () => {
    const store = new MemoryEntitlementStore();
    await store.grant('route/a', '0XABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD');

    expect(await store.has('route/a', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBe(true);
  });
});

describe('createKvEntitlementStore', () => {
  function makeFakeKv(): KvStore {
    const sets = new Map<string, Set<string>>();
    return {
      async get() {
        return null;
      },
      async set() {},
      async del() {},
      async setNxEx() {
        return true;
      },
      async sadd(key, member) {
        let s = sets.get(key);
        if (!s) {
          s = new Set();
          sets.set(key, s);
        }
        s.add(member);
      },
      async sismember(key, member) {
        return sets.get(key)?.has(member) ?? false;
      },
      async update() {
        throw new Error('not used');
      },
    };
  }

  it('grants and checks via sadd/sismember', async () => {
    const store = createKvEntitlementStore(makeFakeKv());
    await store.grant('route/a', '0xWalletA');
    expect(await store.has('route/a', '0xwalleta')).toBe(true);
    expect(await store.has('route/a', '0xwalletb')).toBe(false);
  });

  it('namespaces keys under siwx:ent: by default', async () => {
    const kv = makeFakeKv();
    const calls: Array<[string, string]> = [];
    const wrapped: KvStore = {
      ...kv,
      sadd: async (key, member) => {
        calls.push([key, member]);
        return kv.sadd(key, member);
      },
    };
    const store = createKvEntitlementStore(wrapped);
    await store.grant('route/a', '0xWalletA');
    expect(calls[0]).toEqual(['siwx:ent:route/a', '0xwalleta']);
  });

  it('respects custom prefix', async () => {
    const kv = makeFakeKv();
    const calls: Array<[string, string]> = [];
    const wrapped: KvStore = {
      ...kv,
      sadd: async (key, member) => {
        calls.push([key, member]);
        return kv.sadd(key, member);
      },
    };
    const store = createKvEntitlementStore(wrapped, { prefix: 'app:e:' });
    await store.grant('route/a', '0xWalletA');
    expect(calls[0]).toEqual(['app:e:route/a', '0xwalleta']);
  });
});
