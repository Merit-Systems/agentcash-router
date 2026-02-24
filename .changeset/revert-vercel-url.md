---
'@agentcash/router': patch
---

Revert baseUrl fallback from VERCEL_URL to NEXT_PUBLIC_BASE_URL. VERCEL_URL gives deployment-specific URLs (e.g. x402scan-abc123.vercel.app), not canonical domains.
