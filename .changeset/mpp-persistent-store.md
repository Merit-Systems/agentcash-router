---
"@agentcash/router": patch
---

Add `mpp.store` option for persistent transaction hash replay protection. Pass `Store.upstash(redis)` or `Store.cloudflare(kv)` to prevent replay attacks across cold starts on Vercel/Cloudflare. Defaults to `Store.memory()` (mppx default).
