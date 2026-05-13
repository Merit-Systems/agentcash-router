---
'@agentcash/router': minor
---

Consolidate all KV/Redis logic into a single `src/kv-store/` module backed by
one cache. **Breaking change** to `RouterConfig`: the three separate store
slots are replaced by a single `kvStore` field, namespaced internally so one
Upstash/Redis instance serves SIWX nonce replay, SIWX entitlement, and MPP
tx-hash replay protection.

**Migration:**

```typescript
// Before
createRouter({
  siwx: {
    nonceStore: createRedisNonceStore(redis),
    entitlementStore: createRedisEntitlementStore(redis),
  },
  mpp: { ..., store: Store.upstash(...), useDefaultStore: true },
});

// After
createRouter({
  // Omit kvStore to auto-bootstrap from KV_REST_API_URL + KV_REST_API_TOKEN.
  // Or inject a custom KvStore:
  kvStore: createUpstashRestClient(url, token),
  mpp: { ... },
});
```

Removed config fields:
- `RouterConfig.siwx.nonceStore`
- `RouterConfig.siwx.entitlementStore`
- `RouterConfig.mpp.store`
- `RouterConfig.mpp.useDefaultStore`
- `mppFromEnv({ useDefaultStore })` option

Removed exports:
- `createRedisNonceStore`, `RedisNonceStoreOptions`
- `createRedisEntitlementStore`, `RedisEntitlementStoreOptions`

Added exports:
- `KvStore`, `KvChange` types
- `createUpstashRestClient(url, token)` — fetch-based REST client, no SDK dep
- `createKvStoreFromEnv()` — reads `KV_REST_API_URL` + `KV_REST_API_TOKEN`
- `withPrefix(kv, prefix)` — namespaces all keys
- `createKvNonceStore(kv, opts?)`, `KvNonceStoreOptions` (prefix defaults to `siwx:nonce:`)
- `createKvEntitlementStore(kv, opts?)`, `KvEntitlementStoreOptions` (prefix defaults to `siwx:ent:`)
- `createKvMppStore(kv, opts?)`, `KvMppStoreOptions` (prefix defaults to `mpp:`)

`MemoryNonceStore` and `MemoryEntitlementStore` are still exported from the
new path. `ioredis` is no longer supported — pass an Upstash REST client (or
any `KvStore` implementation).

**Why:** all three stores used Redis under different shapes (Upstash SDK,
ioredis, Upstash REST). Most production deployments already pointed all of
them at the same Upstash instance. Collapsing to one slot eliminates triple
configuration, removes the duplicated `detectRedisClientType` heuristic, and
drops the `@upstash/redis` / `ioredis` integration surface — the router now
talks to Redis through exactly one file (`src/kv-store/client.ts`) using
plain `fetch`.
