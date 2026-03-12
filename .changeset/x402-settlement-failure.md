---
'@agentcash/router': patch
---

Fix x402 settlement failure handling so the router no longer returns the handler's success response when settlement reports `success: false`.

- Treat `settlePayment()` returning `success: false` as a real settlement failure
- Do not attach a contradictory `PAYMENT-RESPONSE` header on failed settlement
- Return a server error instead of leaking a false-positive paid response
