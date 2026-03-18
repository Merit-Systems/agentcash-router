---
"@agentcash/router": minor
---

feat: MPP identity auth on SIWX routes

SIWX routes now accept MPP credentials as an alternative way to prove wallet identity.
Clients that implement MPP (like `tempo request`) but not SIWX can authenticate by
responding to a `$0` MPP challenge — no funds move, just a signed credential proving
wallet ownership.

**What changed:**
- `authMode: 'siwx'` routes now issue a `WWW-Authenticate: MPP` header alongside the
  existing `PAYMENT-REQUIRED` / SIWX challenge when `mpp` is configured in the router
- Incoming `Authorization: Payment <credential>` on a SIWX route is verified at `$0` via
  mppx; the wallet address is extracted from the `did:pkh` credential and passed to the
  handler identically to a SIWX flow
- No API changes — existing `.siwx()` routes gain MPP identity support automatically when
  the router is configured with `mpp: { secretKey, currency, recipient }`
