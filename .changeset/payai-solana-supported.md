---
'@agentcash/router': minor
---

Replace Solana x402 enrichment with GET `/supported` only (PayAI default); remove Corbits `/accepts` path and `createAcceptsHeaders`.

Fix `createRouter` price-key inference when a `RouterConfig` is passed without a `prices` map, restoring per-route `.paid()` typechecking.
