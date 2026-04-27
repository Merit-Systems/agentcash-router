---
"@agentcash/router": patch
---

Bump `mppx` peer/dev dependency from `^0.5.10` to `^0.6.5`. Picks up scope-bound credential replay protection (0.6.1–0.6.2), discovery `x-payment-info.offers[]` canonical output (0.6.4), and assorted Tempo charge hardening. The 0.6.0 default-`Accept-Payment` change is browser-only and does not affect the server-side router.
