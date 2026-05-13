---
'@agentcash/router': minor
---

**Highlights**

- x402 `upto` scheme and MPP payment-channel sessions, both wired to
  handler-driven dynamic pricing.
- `charge()` is now a tick-based no-arg event: one call = one tick =
  `tickCost` USDC = one route-defined unit (token, byte, frame).
- Spec-aligned split between request-mode (`async (ctx) => value`) and
  streaming-mode (`async function* (ctx)`) handlers — `charge` is only
  present on the streaming context.
- A single `kvStore` slot now backs SIWX nonce, SIWX entitlement, and MPP
  tx-hash replay (namespaced internally). Pass `{ url, token }` for an
  Upstash-compatible REST endpoint (Upstash, Vercel KV), bring your own
  `KvStore`, or omit it to auto-bootstrap from `KV_REST_API_URL` +
  `KV_REST_API_TOKEN`.

**Breaking interface changes**

- `RouterConfig.siwx.nonceStore` / `.entitlementStore`,
  `RouterConfig.mpp.store` / `.useDefaultStore`, and
  `mppFromEnv({ useDefaultStore })` are removed — collapsed into
  `RouterConfig.kvStore`.
- `createRedisNonceStore`, `createRedisEntitlementStore`,
  `createUpstashRestClient`, and `createKvStoreFromEnv` are no longer
  exported. Use `kvStore: { url, token }` or implement `KvStore`.
- `DynamicHandlerContext` is renamed to `StreamingHandlerContext` and is
  only attached to streaming handlers. Calling `charge()` from a
  non-generator `async` handler is now a compile-time error.
- `.paid({ dynamic: true })` requires `tickCost`; the builder throws at
  route registration if missing.
