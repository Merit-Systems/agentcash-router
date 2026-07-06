---
'@agentcash/router': minor
---

Developer/agent-experience audit fixes: real compile-time builder safety, typed registration errors, and doc corrections.

**Builder invariants are now compile-time errors.** The `RouteBuilder` phantom generics previously only enforced "pick an auth mode before `.handler()`"; every other documented mutual-exclusion rule compiled clean and threw at module-import time. The builder now tracks identity mode (`IdentMode`: `'none' | 'siwx' | 'apiKey' | 'open'`) and pricing mode (`BillingMode` gains `'exact'`), so all of these are TypeScript errors with readable `RouteError<'…'>` messages, matching the runtime throws: repeat pricing calls (`.paid().upTo()`), `.unprotected()` combined with anything, `.siwx()` + `.apiKey()`, `.siwx()` + `.metered()`, and `.stream()` off `.metered()`. Type-level regression tests live in `tests/builder.test-d.ts`, run by vitest's typecheck pass. Code that compiled before but threw at import time may now fail `tsc` — that's the point; runtime behavior is unchanged, with one fix below.

**Fix: `.unprotected().apiKey(...)` no longer silently ignored `.unprotected()`.** `.apiKey()` was missing the mutual-exclusion guard every sibling method has; the combination now throws at registration (and fails to compile), in both call orders.

**New: `RouteDefinitionError`.** All registration-time builder throws (invalid combos, malformed prices, missing protocol config) are now instances of the exported `RouteDefinitionError` (with a `.route` field) instead of plain `Error` — the registration-time sibling of `RouterConfigError`. Messages are unchanged.

**Deprecated: `.wellKnown()` / `/.well-known/x402` as a discovery surface.** The handler keeps working — existing deployments and legacy x402-native clients are unaffected — but it is no longer recommended: `ServiceRouter.wellKnown()` carries an `@deprecated` JSDoc tag, the README no longer suggests mounting it, the example apps no longer mount it at all, and the `router.notFound()` 404 body's `discovery` hint now lists only `openapi` and `llmsTxt` (the `wellKnown` field was removed). Recommended discovery surfaces are `/openapi.json` and `/llms.txt`.

**Docs.** Fixed contradictory discovery paths in shipped doc comments (`/api/openapi` and `.well-known/agentcash` → the real `/openapi.json`); README documents the recommended discovery route files (`openapi()`, `llmsTxt()`), adds `.method('GET')` to the health example (the exported const name never affects the advertised discovery verb), documents the 402 challenge shape per auth mode (header-only for payment routes, JSON body for SIWX), the `X-Agent-Identity` DID-auth header, `.upTo()`'s `CHARGE_OVER_CAP` behavior, the init-time facilitator fetch, when the body is validated relative to the 402 challenge, and a local-dev MPP keypair recipe.

**Internal.** De-duplicated `getConfiguredX402Accepts` (config/schema now imports the canonical copy), protocol header detection (`hasX402Payment`/`hasMppPayment` shared between `detectProtocol` and the strategies), and the verbatim static/dynamic paid-flow prefix (new `runPaidPreamble`/`runPaidVerify` in `pipeline/flows/paid-preamble.ts`).
