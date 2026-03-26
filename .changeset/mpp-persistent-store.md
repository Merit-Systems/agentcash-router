---
"@agentcash/router": patch
---

Add `mpp.store` and `mpp.useDefaultStore` for persistent transaction hash replay protection.

- `mpp.store` — pass any `Store.Store` implementation (e.g. `Store.cloudflare(kv)`, `Store.upstash(redis)`)
- `mpp.useDefaultStore` — set to `true` to auto-configure an Upstash store from Vercel KV env vars (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) with zero extra dependencies
- Without either, mppx defaults to `Store.memory()` (unchanged behavior)
