---
"@agentcash/router": patch
---

Fix facilitator 429 rate limits on Vercel cold starts breaking all paid routes

- Hardcode `getSupported()` for EVM exact scheme — eliminates the HTTP call to CDP facilitator on every cold start. `verify()` and `settle()` still use the real facilitator.
- Return 500 (not bare 402) when x402 challenge build fails — operators see a clear error instead of clients getting an unpayable 402 with no payment info.
