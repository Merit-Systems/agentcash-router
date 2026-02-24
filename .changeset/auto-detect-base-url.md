---
"@agentcash/router": patch
---

fix: auto-detect baseUrl from VERCEL_URL, remove NEXT_PUBLIC_BASE_URL

baseUrl is now auto-resolved: `config.baseUrl` > `VERCEL_URL` > `localhost:PORT`.
Consumers on Vercel no longer need to pass baseUrl or set any custom env vars.
The `NEXT_PUBLIC_BASE_URL` fallback has been removed.
