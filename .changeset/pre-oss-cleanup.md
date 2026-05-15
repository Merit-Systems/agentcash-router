---
'@agentcash/router': patch
---

`TieredPricing.challengeQuote` is now `async`, so a rejected `quote()` falls
back to the max-tier price instead of escaping a synchronous `try/catch` — a
body missing the tier discriminator field no longer rejects the challenge.

Malformed JSON request bodies now return a `400 Invalid JSON` response instead
of being silently parsed as `undefined` (indistinguishable from an empty body).
Empty and whitespace-only bodies remain valid.

Routes with no `.body()` and no `.query()` now emit a bazaar discovery
extension instead of none, so no-input endpoints stay visible to discovery
validators. `bodyType` is derived from the HTTP method.

Internal: `build402` is renamed to `buildChallengeResponse` and its file to
`challenge-response.ts`.
