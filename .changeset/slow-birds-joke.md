---
"@agentcash/router": minor
---

Add paid plus SIWX acceleration support with pluggable entitlement storage.

This release adds:

- `.paid(...).siwx()` route composition for paid routes with SIWX acceleration
- `EntitlementStore` support with in-memory and Redis-backed adapters
- OpenAPI discovery improvements for auth and payment signaling
