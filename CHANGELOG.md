# @agentcash/router

## 1.10.6

### Patch Changes

- 87e1167: Add a router-provided unmatched-route fallback that returns a rediscovery hint.
- 4a32619: Add an optional paid-route checkout session builder that emits router-owned checkout metadata in 402 challenge response bodies.

## 1.10.5

### Patch Changes

- 4a9586b: Add a route-level checkout flag to OpenAPI `x-payment-info` discovery.
- 9a4b8a6: Retry failed x402 CDP settlement responses with backoff.

## 1.10.4

### Patch Changes

- f98e006: Emit request IDs on responses and pass structured router error bodies plus rich error context to plugins.

## 1.10.3

### Patch Changes

- 4e9b2f9: Make `TEMPO_RPC_URL` optional and default it to the public Tempo endpoint (`https://rpc.tempo.xyz`).

  The config previously treated `TEMPO_RPC_URL` as a hard requirement whenever MPP was enabled, failing with `missing_mpp_rpc_url`, and the docs/messages claimed the public `rpc.tempo.xyz` returns 401. That claim is false — the public endpoint returns 200 with valid JSON-RPC responses (verified against `eth_chainId`/`eth_blockNumber`, including under rapid-fire requests). Requiring an authenticated URL was unnecessary friction.

  `TEMPO_RPC_URL` is now optional. When neither `mpp.rpcUrl` nor `TEMPO_RPC_URL` is set, the router falls back to the new exported `DEFAULT_TEMPO_RPC_URL` constant. Override it only if you have a dedicated endpoint.
  - Added and exported `DEFAULT_TEMPO_RPC_URL` (`https://rpc.tempo.xyz`).
  - Removed the `missing_mpp_rpc_url` config error (and the now-dead issue code from `RouterConfigIssue`'s code union). A `TEMPO_RPC_URL` that _is_ provided is still validated as a URL (`invalid_mpp_rpc_url`).
  - Updated README, the Vercel deploy example, and all messages/comments to drop the inaccurate 401 framing.

## 1.10.2

### Patch Changes

- 52a18ef: Migrate to the `createSIWxResourceServerExtension({ storage })` factory from `@x402/extensions@2.13.0` and require `@x402/* ^2.13.0`.

  `@x402/extensions@2.13.0` replaced the `siwxResourceServerExtension` value export with a `createSIWxResourceServerExtension({ storage })` factory. The router still destructured the old name, so fresh installs that resolved 2.13 crashed at boot with `TypeError: Cannot read properties of undefined (reading 'key')` inside `x402ResourceServer.registerExtension` — surfaced to handlers as the opaque `Payment protocol initialization failed. x402: Cannot read properties of undefined (reading 'key')`.

  The router only relies on the extension's `enrichPaymentRequiredResponse` hook (which refreshes the SIWX challenge — nonce, issuedAt, domain, supportedChains — on the paid+SIWX challenge path); that hook is unchanged in the factory. The factory's additional `onAfterSettle`/`onProtectedRequest` hooks never fire here, because the router settles via the low-level resource server with `declaredExtensions` unset and never uses the HTTP transport layer. Entitlement and nonce replay remain owned by the router's own pipeline, so the `storage` argument is satisfied with an inert `InMemorySIWxStorage`.
  - `@x402/core: ^2.11.0` → `^2.13.0`
  - `@x402/evm: ^2.11.0` → `^2.13.0`
  - `@x402/extensions: ^2.11.0` → `^2.13.0`
  - `@x402/svm: ^2.11.0` → `^2.13.0`

## 1.10.1

### Patch Changes

- 1b20341: Derive `BASE_URL` from Vercel system environment variables when it is not set explicitly.

## 1.10.0

### Minor Changes

- e747a67: Require `maxPrice` on dynamic pricing routes to prevent zero-dollar challenges on bare probes

## 1.9.4

### Patch Changes

- 1ba13d3: Migrate release pipeline to npm trusted publishing. Folds canary snapshot publishing into `publish.yml` so both jobs share the trusted workflow filename.
- 6fd690f: Fix `.upTo().siwx()` composition and reject `.metered().siwx()` at build time.

  Previously, `.siwx()` combined with `.upTo()` blew up on the entitlement fast path with `charge is not a function` (issue #257) because the SIWX replay handler context lacked the `charge` field that `.upTo()` handlers expect. Now `invokeUnauthed` injects a no-op `charge` on the SIWX fast path of `.upTo()` routes — preserving the "pay once, replay free with a wallet signature" semantic.

  `.metered().siwx()` (per-tick MPP billing + entitlement) is now rejected by the builder in both compose orders — per-tick billing has no coherent entitlement model.

## 1.9.3

### Patch Changes

- cc73d51: Emit `security: []` in `/openapi.json` for routes built with `.unprotected()`. Per OpenAPI 3.x, an empty security array on an operation explicitly overrides any global security requirement — the spec-native way to declare a route as public. Previously, unprotected routes emitted no `security` field at all, which is indistinguishable from "author forgot to declare auth" and caused `@agentcash/discovery` (and any other OpenAPI consumer) to flag the route as missing an auth mode. Pairs with `@agentcash/discovery >= 1.6.6`, which reads `security: []` as `authMode: 'unprotected'`. Older discovery versions and other OpenAPI tooling ignore it — no regression.

## 1.9.2

### Patch Changes

- 2708b90: Correct the README install instructions: `next` and `zod` are now the only peer dependencies. The x402 packages, `mppx`, `viem`, and `zod-openapi` install automatically as regular dependencies.

## 1.9.1

### Patch Changes

- e61b3f2: Reclassify dependencies by API boundary. Runtime payment libraries (`@coinbase/x402`, `@x402/core`, `@x402/evm`, `@x402/extensions`, `@x402/svm`, `mppx`, `viem`) and `zod-openapi` move from `peerDependencies` to `dependencies` — they are internal implementation details and never appear in the router's exported types. `next` and `zod` remain `peerDependencies` because their types and instances cross the public API boundary and must resolve to the host app's copy.

## 1.9.0

### Minor Changes

- f93eb82: Pre-open-source readiness cleanup.

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

## 1.8.0

### Minor Changes

- 470329e: Split the `.upTo()` scheme into its own dynamic-invoke flow, separate from
  `.metered()`. `withScopedKinds` now merges each facilitator kind's `extra`
  (carrying `facilitatorAddress`) instead of replacing the kinds list, so
  `.upTo()` routes are payable again while spurious networks stay filtered.

  `DynamicPricing.quote()` rethrows `HttpError` instead of swallowing it into a
  `maxPrice` charge, so a pricing function's pre-payment rejection returns its
  intended non-2xx response rather than billing the caller the cap.

  Mixing `.upTo()` and `.metered()` protocol configs on a route now throws at
  build time. `OrchestrateDeps` is renamed to `RouterDeps`.

## 1.7.1

### Patch Changes

- fbd85d1: Scope each x402 facilitator client's `getSupported().kinds` to the networks
  that group actually configures. Previously the EVM client returned its
  facilitator's live `/supported` kinds verbatim; when the facilitator
  advertised a network outside the group (e.g. CDP claiming `solana:*`), it
  would win the first-write-wins slot in `x402ResourceServer.initialize()`'s
  routing map and poach settle routing from the group that actually configured
  that network — causing Solana settles to land at CDP instead of the
  configured Solana facilitator. `extensions` and `signers` still flow through
  unchanged so the upto scheme keeps the facilitator-provided fields it signs
  into the Permit2 witness.
- 6c77b78: Cache the x402 facilitator `/supported` response in the configured `kvStore`
  (1h TTL under `x402:facilitator-supported:<url>`) so serverless cold starts
  don't all re-fetch from the facilitator. Declare the `eip2612GasSponsoring`
  challenge extension whenever any configured x402 accept is `upto` on an EVM
  network. Behavior is unchanged for routers without a `kvStore` and routes
  without an EVM upto accept.
- 6d95349: Fix float-precision bug in dynamic and tiered pricing caps. Both cap paths
  previously used `parseFloat` to compare USDC decimal strings — a payments
  library doing float comparison on money — which could mis-cap prices near
  6-decimal boundaries.

  Consolidated all money-handling primitives into `src/pricing/format.ts`
  (`decimalToAtomic`, `atomicToDecimal`, `compareDecimals`, `isPositiveDecimal`,
  `multiplyDecimal`) and rewired the existing call sites:
  - `DynamicPricing` cap and `TieredPricing.maxTierPrice` now compare in bigint.
  - `builder.ts` price/tickCost/maxPrice validators use `isPositiveDecimal`.
  - `discovery/openapi.ts` tier min/max selection compares in bigint.
  - `protocols/x402/requirements.ts` inline decimal→atomic helper replaced.
  - `protocols/mpp/strategy.ts` local `multiplyDecimal` deleted in favor of the
    shared one.
  - Removed `src/pricing/atomic.ts` (folded into `format.ts`).

  No public API change. Pricing config strings that previously over-truncated
  fractions beyond 6 decimals (e.g. `"0.0000001"`) now fail validation at
  configuration time instead of silently rounding to zero.

## 1.7.0

### Minor Changes

- ad4bc1f: Cleanup and paved-road release. Public API gains `createRouterFromEnv` and
  loses ~60 incidental re-exports. Plugin internals and `src/` layout are
  consolidated.

  **Paved-road init: `createRouterFromEnv`** (#225). Reads `process.env`,
  validates every value up front, and throws a single `RouterConfigError` with
  every problem at once. Auto-enables MPP when `MPP_SECRET_KEY` is set,
  auto-adds a Solana accept when `SOLANA_PAYEE_ADDRESS` is set, auto-enables
  MPP session mode when `MPP_OPERATOR_KEY` is set. Env vars are documented on
  the function's own JSDoc (grouped x402 / Solana / MPP / Other); a copy-paste
  `.env.example` ships at the repo root.

  **Pruned public surface** (#225). ~60 exports removed from `src/index.ts` —
  store classes, the `RouterConfigError` toolkit, `consolePlugin`, internal
  plugin sub-types, `RouteBuilder`/`RouteRegistry`, and monitor/quota/alert
  plumbing. The underlying source is unchanged; these symbols just stop being
  re-exported. `knip` is wired into `pnpm check` so this stays clean. Consumers
  that imported any of the removed symbols by name will need to inline or
  rebuild equivalent logic.

  **Constant renames** (#225):
  - `BASE_NETWORK` → `BASE_MAINNET_NETWORK`
  - `BASE_USDC_ASSET` → `BASE_USDC_ADDRESS`
  - `TEMPO_USDC_CURRENCY` → `TEMPO_USDC_ADDRESS`
  - Adds `TEMPO_USDC_DECIMALS` for Base/Tempo symmetry; removes the duplicate
    `DEFAULT_SOLANA_FACILITATOR_URL`.

  **Plugin internals consolidated** (#220).
  - `src/plugin.ts` → `src/plugin/index.ts`,
    `src/alert.ts` → `src/plugin/reporter.ts`,
    `src/pipeline/context/plugin-events.ts` → `src/plugin/events.ts` with new
    `fireAuthVerified` / `firePaymentVerified` / `firePaymentSettled` helpers
    plus the migrated `firePluginResponse` and `fireProviderQuota`.
  - 17 pipeline files collapse their inline plugin-hook fires to one-line
    helper calls. `firePluginHook` is now imported by 4 files instead of 18.
  - Inline `onAlert` fires unify through `ctx.report`; the handler-facing
    `ctx.alert` shims alias `ctx.report` directly.

  **`src/` layout cleanup** (#220).
  - Top-level pipeline files moved into `src/pipeline/`:
    `orchestrate.ts`, `handler.ts`, `body.ts`, `alert.ts`.
  - Init surfaces consolidated under `src/init/`:
    `src/server.ts` → `src/init/x402-server.ts`,
    `src/mppx-init.ts` → `src/init/mppx.ts`.
  - `src/pipeline/context/` renamed to `src/pipeline/steps/` — the 22 files
    inside are pipeline steps, not "context" operations.

  **Docs + examples** (#220, #225).
  - README rewritten (656 → ~270 lines) around install / env / quick-start /
    auth-modes / pricing / discovery, with the AgentCash wordmark and tagline
    at the top.
  - `AGENTS.md` at the repo root captures the critical invariants that
    previously lived in `.claude/CLAUDE.md`: error `.status` semantics, SIWX
    challenge format, discovery visibility rules, duplicate-key behavior,
    dynamic-pricing body parse, and the MPP operator vs fee-payer vs recipient
    invariants. `package.json` `files` now ships `AGENTS.md` + `README.md`
    instead of the old `.claude/` paths.
  - `examples/mpp-native/` and `examples/x402-native/` removed — they
    duplicated demos already covered by `examples/fortune/`.
  - `examples/fortune/test-session-alignment.ts` and
    `test-x402-exact-upto.ts` moved to `tests/integration/` with a
    `tests/integration/README.md` covering how to run them against live RPC
    endpoints.
  - Solana flagged as exact-only across env tables and `.env` files (dynamic
    `upto` pricing is Base-only).

  **CI** (#225). Runs `pnpm check` directly so it can't drift from local.

## 1.6.0

### Minor Changes

- 19f4554: **Highlights**
  - x402 `upto` scheme and MPP payment-channel sessions, both wired to
    handler-driven dynamic pricing.
  - `charge()` is now a tick-based no-arg event: one call = one tick =
    `tickCost` USDC = one route-defined unit (token, byte, frame).
  - Spec-aligned split between request-mode (`async (ctx) => value`) and
    streaming-mode (`async function* (ctx)`) handlers — `charge` is only
    present on the streaming context.
  - A single `kvStore` slot now backs SIWX nonce, SIWX entitlement, and MPP
    tx-hash replay (namespaced internally). Pass `{ url, token }` for an
    Upstash-compatible REST endpoint (Upstash, Vercel KV), bring your own
    `KvStore`, or omit it to auto-bootstrap from `KV_REST_API_URL` +
    `KV_REST_API_TOKEN`.

  **Breaking interface changes**
  - `RouterConfig.siwx.nonceStore` / `.entitlementStore`,
    `RouterConfig.mpp.store` / `.useDefaultStore`, and
    `mppFromEnv({ useDefaultStore })` are removed — collapsed into
    `RouterConfig.kvStore`.
  - `createRedisNonceStore`, `createRedisEntitlementStore`,
    `createUpstashRestClient`, and `createKvStoreFromEnv` are no longer
    exported. Use `kvStore: { url, token }` or implement `KvStore`.
  - `DynamicHandlerContext` is renamed to `StreamingHandlerContext` and is
    only attached to streaming handlers. Calling `charge()` from a
    non-generator `async` handler is now a compile-time error.
  - `.paid({ dynamic: true })` requires `tickCost`; the builder throws at
    route registration if missing.

## 1.5.2

### Patch Changes

- 5571cdb: Internal refactor: split `orchestrate.ts` (~1525 lines), `protocols/x402.ts` (~398 lines), and `pricing.ts` into focused per-concern modules. No public API or behavior changes.
  - `orchestrate.ts` is now a thin dispatcher into per-authMode flows under `src/pipeline/flows/` (`paid`, `siwx-only`, `api-key-only`, `unprotected`), with each pipeline step extracted into single-purpose helpers under `src/pipeline/context/`.
  - `protocols/x402.ts` and `protocols/mpp-siwx.ts` reorganized into `src/protocols/x402/` and `src/protocols/mpp/`, each with a `strategy.ts` entry point and dedicated verify/settle/challenge submodules.
  - `pricing.ts` split into `src/pricing/{fixed,tiered,dynamic,types,index}.ts`.
  - Removed unused `src/client/index.ts` (162 lines).
  - New `src/headers.ts` for shared header helpers.

## 1.5.1

### Patch Changes

- 1bf0b0c: Bump `mppx` peer/dev dependency from `^0.5.10` to `^0.6.5`. Picks up scope-bound credential replay protection (0.6.1–0.6.2), discovery `x-payment-info.offers[]` canonical output (0.6.4), and assorted Tempo charge hardening. The 0.6.0 default-`Accept-Payment` change is browser-only and does not affect the server-side router.

## 1.5.0

### Minor Changes

- d06a164: Add config validation helpers, shared network/currency constants, env builders for x402 and MPP setup, explicit handler payment metadata, and route-level settlement lifecycle hooks.
  - Adds `.settlement({ beforeSettle, afterSettle, onSettledHandlerError, onSettlementError })` for pre-settlement validation, post-settlement bookkeeping, and app-owned compensation queues when already-settled MPP work fails in the handler.
  - Adds inline example shorthand on `.body(schema, example)`, `.query(schema, example)`, and `.output(schema, example)`, while keeping schema examples optional. This intentionally removes the 1.4.0 compile-time requirement to call `.inputExample()` / `.outputExample()` before `.handler()`; supplied examples still validate at registration.
  - Fixes dynamic paid requests to verify against the capped `maxPrice`, preserves original MPP settlement rejection details for lifecycle hooks, and rejects repeated `.paid()` calls on the same route.
  - `createRouter()` now throws `RouterConfigError` for protocol config errors in production. Development keeps protocol init failures deferred to request-time JSON errors so local debugging remains incremental.

## 1.4.1

### Patch Changes

- 5487bd8: Return body validation errors before 402 challenges for unpaid dynamic-price routes that require the request body to quote or validate.

## 1.4.0

### Minor Changes

- 9ba7431: Fix bazaar discovery extension and require `.inputExample()` / `.outputExample()` on every route with a schema.

  **Bug fixes (no opt-in needed):**
  - `bazaar.info.input.method` is now populated from `routeEntry.method`. Previously omitted — the `@x402/extensions/bazaar` validator rejects declarations missing `method` (`QueryInput` requires `method ∈ {GET,HEAD,DELETE}`, `BodyInput` requires `{POST,PUT,PATCH}`), so no routes with schemas were indexable.
  - The `output` block is now only emitted when a real example is registered. Previously emitted `output.example: {}`, which failed the user's `outputSchema` for every route with a required field on the response.
  - `info.input.body` (body routes) and `info.input.queryParams` (query routes) are now populated from the registered example instead of defaulting to `{}`, which failed the user's `bodySchema` / `querySchema` whenever it had a required field.

  **Breaking — new required builder steps:**

  Every route using `.body()` / `.query()` must call `.inputExample(sample)` with a schema-conforming sample before `.handler()`. Every route using `.output()` must call `.outputExample(sample)`.

  ```ts
  router.route('search')
    .paid('0.01')
    .body(SearchSchema)
    .inputExample({ query: 'hello world' })        // NEW — required
    .output(ResultsSchema)
    .outputExample({ results: [{ id: '1' }] })     // NEW — required
    .handler(async ({ body }) => { ... });
  ```

  Enforcement is both:
  - **Compile-time** via `.handler()` TS overloads — missing example calls fail typecheck.
  - **Runtime** at module-load — examples are `safeParse`'d against their Zod schemas; a `.refine()`/`.min()`/etc. violation throws before the route is registered, surfacing as a `next build` failure with the specific issue path.

  Migration: for every route with a schema, add `.inputExample(...)` / `.outputExample(...)` calls with conforming sample data. The Zod validator will tell you exactly which fields are off.

## 1.3.3

### Patch Changes

- 5b46274: Update type signature of upstash kv store

## 1.3.2

### Patch Changes

- 2cff6ae: add update method to kv cache

## 1.3.1

### Patch Changes

- 4404d20: bump versions, support upto

## 1.3.0

### Minor Changes

- 2bd5283: Set meaningful MPP defaults in x-payment-info (method: "tempo", intent: "charge", currency: Tempo USDC address) and add optional `mpp` override in PaidOptions

## 1.2.6

### Patch Changes

- b538973: Fix x-payment-info price field name from `value` to `amount` for discovery 1.5.0 spec compliance

## 1.2.5

### Patch Changes

- bd04b6d: fix: route-level payTo takes priority over global accepts config
- a00a4c5: bump mppx

## 1.2.4

### Patch Changes

- 17a25af: Bump mppx to 0.4.10
- 1907135: Add `mpp.store` and `mpp.useDefaultStore` for persistent transaction hash replay protection.
  - `mpp.store` — pass any `Store.Store` implementation (e.g. `Store.cloudflare(kv)`, `Store.upstash(redis)`)
  - `mpp.useDefaultStore` — set to `true` to auto-configure an Upstash store from Vercel KV env vars (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) with zero extra dependencies
  - Without either, mppx defaults to `Store.memory()` (unchanged behavior)

## 1.2.3

### Patch Changes

- 4172367: Expose `info.x-guidance` alongside `info.guidance` in OpenAPI output. The `x-` prefix follows the OpenAPI extension naming convention for custom fields.

## 1.2.2

### Patch Changes

- 92eb537: Bump mppx from 0.4.2 to 0.4.8
- 1bc60a9: Fix Base transactions failing when Solana facilitator is unavailable. Facilitator enrichments now resolve per-group — a Solana `/accepts` failure drops the Solana requirement from the challenge and logs a warning, leaving EVM requirements intact.

## 1.2.1

### Patch Changes

- 039f301: partial mpp payment failure mode

## 1.2.0

### Minor Changes

- d9c4bde: feat: MPP identity auth on SIWX routes

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

### Patch Changes

- d0bd6b3: fix(pricing): fall back to maxPrice when dynamic pricing function returns NaN

  Previously, if a dynamic pricing function returned `NaN` (e.g. due to missing body fields or a calculation error), the router would propagate `NaN` as the price, causing malformed 402 challenges. Now, when the resolved price is `NaN` and a `maxPrice` is configured, the router falls back to `maxPrice`. If no `maxPrice` is set, an error is thrown.

## 1.1.10

### Patch Changes

- 5717cb9: 4xx bugs

## 1.1.9

### Patch Changes

- 7a77052: Fix Bazaar schema generation failing silently for Zod schemas that use `.transform()` or `.refine()`.
  - Pass `unrepresentable: 'any'` to `z.toJSONSchema()` so untranslatable fields emit `{}` instead of throwing
  - Replace silent `catch {}` with `onAlert('warn')` so operators see failures in telemetry

- 7a77052: Fix x402 settlement failure handling so the router no longer returns the handler's success response when settlement reports `success: false`.
  - Treat `settlePayment()` returning `success: false` as a real settlement failure
  - Do not attach a contradictory `PAYMENT-RESPONSE` header on failed settlement
  - Return a server error instead of leaking a false-positive paid response

## 1.1.8

### Patch Changes

- b9fb4f6: use diff sig scheme

## 1.1.7

### Patch Changes

- 4b99f6c: pass body to build402

## 1.1.6

### Patch Changes

- 2aed725: Fix bug with mpp dynamic routes

## 1.1.5

### Patch Changes

- 39ff764: Add feepayer and cache controls"
- b597029: bump again

## 1.1.4

### Patch Changes

- 0d5b928: bump mppx

## 1.1.3

### Patch Changes

- 8f1a92d: Prevent Solana facilitator cold-start failures from taking down mixed Base plus Solana x402 routes.

## 1.1.2

### Patch Changes

- cfe2aa9: siwx on solana

## 1.1.1

### Patch Changes

- 8c83c21: Fix x402 settlement failure handling so the router no longer returns the handler's success response when settlement reports `success: false`.
  - Treat `settlePayment()` returning `success: false` as a real settlement failure
  - Do not attach a contradictory `PAYMENT-RESPONSE` header on failed settlement
  - Return a server error instead of leaking a false-positive paid response

## 1.1.0

### Minor Changes

- 4ffa40c: Add dual-network x402 support (Base + Solana) with zero breaking changes
  - New additive `x402.accepts[]` config for multi-network payment options
  - Existing `payeeAddress` + `network` shorthand continues to work as before
  - 402 challenges advertise all configured networks in a single response
  - Verification matches the client-selected accepted requirement (not a rebuilt one)
  - Settlement routes to the correct network based on the matched requirement
  - SVM exact scheme registered when Solana networks are configured
  - Custom (non-exact) schemes supported for Faremeter settlement-account flows
  - Stable-field matching handles rotating facilitator extras (e.g. feePayer, recentBlockhash)

## 1.0.1

### Patch Changes

- 6cb8bf2: fix(registry): include HTTP method in registry map key so POST and DELETE on the same path coexist

  Previously both methods shared the same key (e.g. `site/domain`), causing the second registration to silently overwrite the first. Only the last-registered method appeared in the OpenAPI spec and well-known discovery. The internal map key is now `{key}:{method}` — same-path-same-method double registration (expected during Next.js build for discovery stubs) still last-write-wins.

## 1.0.0

### Major Changes

- c25a099: # Unified discovery config

  Discovery is now configured once in `createRouter({ discovery })` instead of split across `openapi()` and `wellKnown()` call sites. A new `llmsTxt()` handler serves agent guidance as plain text.

  ## Migration

  **Before:**

  ```typescript
  export const GET = router.openapi({
    title: 'My API',
    version: '1.0.0',
    llmsTxtUrl: 'https://example.com/llms.txt',
    ownershipProofs: [...],
  });

  export const GET = router.wellKnown({
    instructions: 'Use /api/search for...',
    ownershipProofs: [...],
  });
  ```

  **After:**

  ```typescript
  const router = createRouter({
    baseUrl: '...',
    discovery: {
      title: 'My API',
      version: '1.0.0',
      guidance: 'Use /api/search for...',  // serves as wellknown instructions + /llms.txt
      ownershipProofs: [...],
    },
  });

  export const GET = router.openapi();
  export const GET = router.wellKnown();
  export const GET = router.llmsTxt();  // new
  ```

  ## Breaking changes
  - `router.openapi(options)` and `router.wellKnown(options?)` are now zero-arg — options move to `createRouter({ discovery })`
  - `OpenAPIOptions` and `WellKnownOptions` types removed — use `DiscoveryConfig`
  - `wellKnown.instructions` renamed to `discovery.guidance`
  - `llmsTxtUrl` removed — inline content via `discovery.guidance` (string or async fn)
  - `baseUrl` override removed from OpenAPI options — always uses `RouterConfig.baseUrl`

## 0.7.1

### Patch Changes

- 1ed50e9: Bump mppx to 0.3.13

## 0.7.0

### Minor Changes

- faa4757: Add paid plus SIWX acceleration support with pluggable entitlement storage.

  This release adds:
  - `.paid(...).siwx()` route composition for paid routes with SIWX acceleration
  - `EntitlementStore` support with in-memory and Redis-backed adapters
  - OpenAPI discovery improvements for auth and payment signaling

## 0.6.8

### Patch Changes

- 20137d9: Bump mppx to 0.3.8

## 0.6.7

### Patch Changes

- 6a0663b: Normalize MPP credential source DID to plain address. MPP credentials use `did:pkh:eip155:<chainId>:<address>` format, but SIWX and x402 return plain `0x...` addresses. Without normalization, jobs created via MPP can't be fetched via SIWX because the wallet strings don't match.

## 0.6.6

### Patch Changes

- 4cd88b7: BREAKING: `baseUrl` is now required in `RouterConfig`. Removed `VERCEL_URL` auto-detection and `localhost` fallback.

  The realm derived from `baseUrl` is load-bearing for payment matching (MPP memo indexing, 402 challenge realm). `VERCEL_URL` returned the internal deployment URL (e.g. `*.vercel.app`) rather than the custom domain, causing payment indexing failures in production.

  Migration: pass `baseUrl` explicitly in your `createRouter()` call.

  ```typescript
  createRouter({
    baseUrl: process.env.BASE_URL!,
    // ...
  });
  ```

## 0.6.5

### Patch Changes

- 11f3a82: fix: auto-detect baseUrl from VERCEL_URL, remove NEXT_PUBLIC_BASE_URL

  baseUrl is now auto-resolved: `config.baseUrl` > `VERCEL_URL` > `localhost:PORT`.
  Consumers on Vercel no longer need to pass baseUrl or set any custom env vars.
  The `NEXT_PUBLIC_BASE_URL` fallback has been removed.

## 0.6.4

### Patch Changes

- 3d20c19: fix: return 402 on discovery probes with empty/invalid body

  When a discovery client (e.g. x402scan) sends a POST with an empty body and no
  payment headers, the early body parsing returned 400 before the 402 challenge
  was built. Now body parse failures with no payment header fall through to
  `build402()` using `maxPrice`, ensuring resources are always discoverable.

  Affects both x402 and MPP protocols. `validateFn` errors on valid bodies still
  return their error status as before.

## 0.6.3

### Patch Changes

- 17ab73c: body parsing

## 0.6.2

### Patch Changes

- af0ea97: fix: correct default type parameter so `.siwx().body()` works without `prices` config

  `createRouter()` without a `prices` config caused `.route(key).siwx().body(schema)` to error with
  "Property 'body' does not exist on type 'never'". The default generic `Record<string, never>` made
  `keyof P` resolve to `string`, so every route key matched as auto-priced (`HasAuth = true`), and
  `.siwx()` returned `never`. Changed the default to `Record<never, string>` so `keyof P` correctly
  resolves to `never` when no prices are configured.

## 0.6.1

### Patch Changes

- ab838c0: Bump mppx to 0.3.4

## 0.6.0

### Minor Changes

- 9b3a5c6: Add `payTo` option to `.paid()` for dynamic payment recipients. Accepts a static string or an async function that receives the `Request` and returns the recipient address. Falls back to the router's default `payeeAddress` when not set.

## 0.5.2

### Patch Changes

- 851fee6: Fix facilitator 429 rate limits on Vercel cold starts breaking all paid routes
  - Hardcode `getSupported()` for EVM exact scheme — eliminates the HTTP call to CDP facilitator on every cold start. `verify()` and `settle()` still use the real facilitator.
  - Return 500 (not bare 402) when x402 challenge build fails — operators see a clear error instead of clients getting an unpayable 402 with no payment info.

## 0.5.1

### Patch Changes

- 89b9bc0: remove trailing slash, bump

## 0.5.0

### Minor Changes

- a16fab7: Require baseUrl in config, or NEXT_PUBLIC_BASE_URL

### Patch Changes

- 897c761: Bump mppx

## 0.4.10

### Patch Changes

- 9b05697: Bump mppx to 0.2.5

## 0.4.9

### Patch Changes

- 9a1c154: massive simplification of mpp logic
- 2bacbc2: fix price tieres'

## 0.4.8

### Patch Changes

- 9f87e41: mppx version bump
- 86f777a: tiered pricing

## 0.4.7

### Patch Changes

- fix(siwx): alphanumeric nonce and supportedChains for spec compliance

## 0.4.6

### Patch Changes

- 2c7f244: logs

## 0.4.5

### Patch Changes

- b058ea6: bump mppx to 0.2.0

## 0.4.4

### Patch Changes

- 3aa200d: returning 500 on settlement failures

## 0.4.3

### Patch Changes

- 9aa6935: move to mppx
