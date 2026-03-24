---
"@agentcash/router": patch
---

Add `mpp.store` and `mpp.useDefaultStore` for persistent transaction hash replay protection. On Vercel, set `useDefaultStore: true` and the router auto-configures an Upstash store from `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Pass a custom `store` for Cloudflare KV or any other backend. Without either, mppx defaults to `Store.memory()`.
