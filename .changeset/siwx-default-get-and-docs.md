---
'@agentcash/router': minor
---

`.siwx()` and `.unprotected()` routes now default the OpenAPI HTTP method to `GET` when no `.body()` schema is declared (instead of always defaulting to `POST`). This matches the README examples (`export const GET = router.route(...).siwx().handler(...)`) and the verb agents expect for read-only wallet-gated and unauthenticated routes. The auto-derive uses this precedence:

1. `.method(m)` always wins.
2. `.query()` declared → `GET`.
3. `.body()` declared → `POST`.
4. `.siwx()` or `.unprotected()` with no body → `GET`.
5. Otherwise → `POST` (paid routes without bodies, `.apiKey()`, etc.).

Paid routes still default to `POST` unchanged. Code that already calls `.method('GET')` continues to work; the call is no longer required for the common case.

Also clarifies in the README that `MPP_FEE_PAYER_KEY` is optional — omit it to make clients pay their own gas. If set, the resulting address must hold native Tempo gas before any traffic, otherwise every paid call fails with a generic `Payment verification failed` while the real `insufficient funds for gas` error only surfaces via `RouterPlugin.onAlert` / `onError`. And calls out that `BASE_URL` is a build-time requirement (not just runtime), with a Vercel-specific note about preferring the stable production alias over the per-deployment URL.
