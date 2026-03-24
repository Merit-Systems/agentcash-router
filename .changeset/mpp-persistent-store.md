---
"@agentcash/router": patch
---

Add `mpp.store` for persistent transaction hash replay protection. Pass `Store.upstash(redis)` or `Store.cloudflare(kv)` to prevent replay attacks across cold starts on Vercel or any multi-instance deployment. Without it, mppx defaults to `Store.memory()`.
