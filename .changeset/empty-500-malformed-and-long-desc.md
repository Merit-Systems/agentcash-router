---
'@agentcash/router': patch
---

Turn two empty-500 failure modes into structured errors: a malformed `X-PAYMENT` header now returns a 402 with `{ reason: 'malformed_payment_header' }` instead of crashing the function, and a paid x402 route whose `.description()` exceeds 400 chars now fails at build time rather than being rejected by the CDP facilitator at request time.
