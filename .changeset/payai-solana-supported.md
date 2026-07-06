---
'@agentcash/router': minor
---

Replace Solana x402 enrichment with GET `/supported` only (PayAI default); remove Corbits `/accepts` path and `createAcceptsHeaders`. Enrichment now reuses the cached `/supported` layer (in-process dedup + optional KV sharing, 10s fetch timeout) instead of fetching per request, and the challenge no longer carries per-request extras like `recentBlockhash` — Solana clients must fetch a fresh blockhash from RPC.

Fix `createRouter` price-key inference when a `RouterConfig` is passed without a `prices` map, restoring per-route `.paid()` typechecking. Note: the type parameter of `createRouter`/`createRouterFromEnv` is now the whole config/options type rather than the `prices` record — callers passing an explicit `prices` type argument must drop it (inference-based callers are unaffected).
