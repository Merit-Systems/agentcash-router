---
'@agentcash/router': minor
---

Pre-open-source readiness cleanup.

`TieredPricing.challengeQuote` is now `async`, so a rejected `quote()` falls
back to the max-tier price instead of escaping a synchronous `try/catch` — a
body missing the tier discriminator field no longer rejects the challenge.

Malformed JSON request bodies now return a `400 Invalid JSON` response instead
of being silently parsed as `undefined` (indistinguishable from an empty body).
Empty and whitespace-only bodies remain valid.

Routes with no `.body()` and no `.query()` now emit a bazaar discovery
extension instead of none, so no-input endpoints stay visible to discovery
validators. `bodyType` is derived from the HTTP method.

Query schema validation now fails closed: invalid `.query()` params return a
structured `400` before the handler runs, instead of being passed through raw
as the schema-typed value.

Fixed `.paid()` prices and `minPrice` are validated at route registration, and
dynamic pricing rejects a malformed or non-positive quote — invalid money
strings fail early instead of leaking into protocol adapters. Whole-dollar
x402 settlement amounts are dollar-tagged consistently (`"1"` → `"$1"`).

Behavior change: `createRouter` now throws on any protocol config error at
construction regardless of `NODE_ENV`, so misconfigurations fail the build
instead of surfacing as request-time errors. This covers the MPP
operator/recipient mismatch (previously a swallowed request-time error) and
CDP facilitator keys, which are now required for EVM x402 in every environment,
not just production — set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` in
development and CI (create a key at https://portal.cdp.coinbase.com).

Internal: `build402` is renamed to `buildChallengeResponse` and its file to
`challenge-response.ts`.
