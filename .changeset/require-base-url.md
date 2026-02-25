---
"@agentcash/router": minor
---

BREAKING: `baseUrl` is now required in `RouterConfig`. Removed `VERCEL_URL` auto-detection and `localhost` fallback.

The realm derived from `baseUrl` is load-bearing for payment matching (MPP memo indexing, 402 challenge realm). `VERCEL_URL` returned the internal deployment URL (e.g. `*.vercel.app`) rather than the custom domain, causing payment indexing failures in production.

Migration: pass `baseUrl` explicitly in your `createRouter()` call.

```typescript
createRouter({
  baseUrl: process.env.BASE_URL!,
  // ...
})
```
