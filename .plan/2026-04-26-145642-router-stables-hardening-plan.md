# Router Stables Hardening Plan

Timestamp: 2026-04-26 14:56:42 America/New_York

Branch: `codex/router-stables-upgrade-plan`

Worktree:
`/Users/samragsdale/Documents/code/merit-systems/agentcash-router-stables-upgrade`

Source audit:
`/Users/samragsdale/Documents/Code/merit-systems/the-stables-router-upgrade-guidance/.plans/2026-04-26-agentcash-router-upgrade-audit.md`

## High-Level Goals

Make `@agentcash/router` harder to misuse across the Stables without making
simple paid routes harder to write.

Primary goals:

1. Reduce repeated app setup boilerplate for base URL, x402 accepts, Solana,
   MPP, Tempo, CDP facilitator keys, SIWX stores, telemetry, and default
   protocol options.
2. Fail early for invalid payment configuration instead of allowing missing env
   vars, placeholder payees, partial protocol setup, or cold-start-only errors.
3. Make pre-payment validation first-class, typed, and reusable by pricing and
   handlers.
4. Make paid side effects safer by giving apps an explicit lifecycle for
   validation, reservation, settlement, commit, compensation, and refund records.
5. Expose payment metadata in handler context so apps do not need to infer
   protocol, payer, network, transaction, or settlement state from headers.
6. Add router-level idempotency primitives for retry-heavy paid operations.
7. Improve discovery ergonomics so apps do not depend on fragile side-effect
   imports for `/.well-known/x402`, `/openapi.json`, and `/llms.txt`.

## Design Constraints

- Keep the current `.paid(...).handler(...)` path stable for simple read-style
  routes. Side-effect-safe flows should be added as a new API, not a silent
  semantic change.
- Prefer additive exports and helpers first. The Stables can migrate route by
  route without blocking a package release.
- Environment variables cannot truly fail at TypeScript compile time. The
  router can still improve this with type-level config unions, env-builder
  helpers, registration-time validation, and startup-time failures before the
  first request.
- Preserve optional peer dependency behavior. x402, Solana, MPP, and Next.js
  integrations should keep lazy imports where practical so unused protocols do
  not force unrelated installs.
- Do not auto-enable protocols from incomplete env. MPP should be enabled only
  when `MPP_SECRET_KEY`, `MPP_CURRENCY`, and `TEMPO_RPC_URL` are all present, or
  when explicit config passes validation.
- Chain-specific wallet canonicalization is load-bearing. EVM addresses are
  lowercase canonical values; Solana addresses preserve casing.
- Base URL remains load-bearing for x402 realm matching, MPP realm/memo
  indexing, OpenAPI servers, and discovery URLs. Any env-derived helper must
  make production base URL explicit and auditable.
- MPP and x402 settlement semantics must be documented and observable. Apps
  should not guess whether handler execution is before or after money movement.
- Discovery output must remain deterministic in cold Next.js isolates.
- Tests need to cover both config-shape failures and request orchestration
  behavior, not just type signatures.

## Existing Router Surface To Respect

Current important files:

- `src/index.ts`: `createRouter`, config validation, dependency initialization,
  discovery handlers, and public exports.
- `src/types.ts`: `RouterConfig`, `RouteEntry`, `HandlerContext`, `PaidOptions`,
  payment config types, and discovery config.
- `src/builder.ts`: fluent route builder, `.paid()`, `.validate()`, schema and
  example requirements.
- `src/orchestrate.ts`: request flow for SIWX, x402, MPP, validation, pricing,
  handler invocation, settlement, entitlement grants, and plugin hooks.
- `src/x402-config.ts`: accept/payee resolution.
- `src/auth/normalize-wallet.ts`: chain-aware wallet normalization.
- `tests/orchestrate.test.ts`, `tests/protocols-config.test.ts`,
  `tests/builder.test.ts`, and `tests/discovery.test.ts`: likely initial test
  targets.

## Proposed Improvement Tracks

### Track 1: Config Hardening And Presets

Add a strict config validation layer before async protocol initialization.

Candidate exports:

```ts
validateRouterConfig(config, options?)
createRouterFromEnv(config)
mppFromEnv(env, options)
x402AcceptsFromEnv(env, options)
SOLANA_MAINNET_NETWORK
TEMPO_USDC_CURRENCY
```

Behavior:

- Reject empty protocol arrays.
- Reject `protocols` containing `mpp` without complete MPP config.
- Reject MPP config missing `secretKey`, `currency`, `rpcUrl`, or an inferable
  recipient.
- Reject `mpp.useDefaultStore` without `KV_REST_API_URL` and
  `KV_REST_API_TOKEN`.
- Reject default EVM x402 facilitator use without `CDP_API_KEY_ID` and
  `CDP_API_KEY_SECRET`, unless a custom EVM facilitator is configured.
- Reject placeholder payee values such as the zero address in production.
- Infer MPP recipient from the static x402 EVM payee when there is exactly one
  static payee.
- Add Solana x402 accepts from `SOLANA_PAYEE_ADDRESS` only when present and
  explicitly supported.
- Return reusable `protocols` and `paidOptions` so apps stop hard-coding
  `["x402", "mpp"]`.

First implementation shape:

- Add `src/config.ts` for pure validation and helper construction.
- Keep `createRouter(...)` as the source of truth but call the new validator.
- Export constants and helpers from `src/index.ts`.
- Add tests before migrating example apps.

### Track 2: Request-Aware Preflight

Current `.validate()` is body-only and returns no typed data. Add a richer
pre-payment hook that can be shared by pricing and handler logic.

Candidate API:

```ts
router
  .route('domain/register')
  .body(RegisterBody)
  .preflight(async ({ body, query, wallet, request }) => {
    const quote = await quoteDomain(body.domain);
    if (!quote.available) throw new HttpError('Domain unavailable', 409);
    return quote;
  })
  .paid(({ preflight }) => preflight.price)
  .handler(async ({ body, preflight }) => {
    return registerDomain(body, preflight);
  });
```

Design notes:

- Preserve existing `.validate(fn)` as shorthand for body-only validation.
- Preflight runs before 402 challenge when the body/query can be parsed.
- Preflight runs before payment verification/charge when payment is present.
- The returned value should be available to dynamic pricing and the handler.
- Avoid double-running expensive validation inside the same request.
- Support typed HTTP failures through `HttpError`.

### Track 3: Payment Context

Extend `HandlerContext` with payment metadata when payment has been verified or
settled enough for the current phase.

Candidate context:

```ts
ctx.payment = {
  protocol: 'x402' | 'mpp',
  status: 'verified' | 'settled',
  payer,
  recipient,
  amount,
  network,
  transaction,
  receipt,
};
```

Design notes:

- Do not expose protocol internals that callers cannot rely on.
- Make absent metadata explicit with optional fields instead of overloading
  empty strings.
- Keep plugin settlement events aligned with handler context.

### Track 4: Paid Operation Lifecycle

Add a new API for routes where the purchased action has irreversible side
effects.

Candidate API:

```ts
router.route('expensive/action').paidOperation({
  body: BodySchema,
  inputExample,
  output: OutputSchema,
  outputExample,
  preflight: async ({ body, wallet }) => ({ price, quote }),
  reserve: async ({ body, wallet, preflight, idempotencyKey }) => reservation,
  commit: async ({ reservation, payment }) => result,
  compensate: async ({ reservation, payment, error }) => {
    await recordRefundOrReleaseInventory(reservation, payment, error);
  },
});
```

Lifecycle:

1. Parse body/query.
2. Run preflight. No payment should move here.
3. Resolve price from preflight.
4. Create or load an idempotent reservation.
5. Verify and settle/charge payment according to protocol.
6. Run commit after confirmed settlement whenever the protocol supports it.
7. Run compensation on post-settlement commit failure.
8. Return a consistent response or stored idempotent result.

Design notes:

- Do not retrofit this behavior into `.paid().handler()` until all semantics
  are proven.
- Name protocol-specific risk clearly. x402 and MPP do not have identical
  payment timing today.
- Compensation should be an application hook; the router should not guess how
  to refund arbitrary providers.

### Track 5: Idempotency

Add router-level idempotency to stop retry storms from rebilling or duplicating
provider work.

Candidate pieces:

- `IdempotencyStore` interface.
- `MemoryIdempotencyStore` for tests/local development.
- Optional adapter helpers for Redis/Upstash.
- Route option to use `Idempotency-Key` header, a body field, or both.
- Stored states for `reserved`, `paid`, `committed`, `failed`, and `expired`.

Initial policy:

- Key by route, canonical wallet, and idempotency key.
- Never replay a result for a different wallet.
- Return the stored successful response when safe.
- Return a clear conflict if the same key is reused with different input.

### Track 6: Discovery Manifest And Next Integration

Reduce manual discovery registration and repeated Next config.

Candidate exports:

```ts
withAgentcashRouter(nextConfig, options)
AGENTCASH_PAYMENT_REQUEST_HEADERS
AGENTCASH_PAYMENT_RESPONSE_HEADERS
generateRouteManifest(...)
```

Design notes:

- Start with constants and docs if a full Next helper is too large.
- Route manifest generation should make cold-isolate discovery deterministic.
- Preserve explicit app control over rewrites and CORS.

## Initial Implementation Plan

1. Add tests that lock the current failure modes:
   - MPP listed in `protocols` without full config.
   - `useDefaultStore` without KV env.
   - default EVM facilitator without CDP env.
   - zero-address payee in production.
   - MPP recipient inference from static x402 payee.
   - chain-safe wallet normalization wording and behavior.
2. Implement `src/config.ts` with pure validation helpers and exported constants.
3. Call config validation from `createRouter(...)` in `src/index.ts`.
4. Add `mppFromEnv(...)` and `x402AcceptsFromEnv(...)` as opt-in helpers.
5. Update README with the strict setup path and explain which failures happen
   at type-check, route registration, router creation, and runtime.
6. Add a small example-router migration in `examples/fortune` or a dedicated
   test fixture.
7. Only then start the larger API additions:
   - request-aware preflight,
   - payment context,
   - idempotency store,
   - paid operation lifecycle.

## First Slice Definition

The first slice should be deliberately small:

- Add constants:
  - `BASE_NETWORK = "eip155:8453"` or documented equivalent.
  - `SOLANA_MAINNET_NETWORK`.
  - `TEMPO_USDC_CURRENCY`.
- Add `validateRouterConfig(config, env?)`.
- Add tests for config validation.
- Wire validation into `createRouter`.
- Export the helper and constants.
- Update README setup guidance.

This gives immediate safety to all Stables without committing to the full paid
operation API design in the same PR.

## Execution Notes

Completed in the first implementation pass:

- Added shared constants for Base, Solana mainnet, Tempo USDC, and the zero EVM
  placeholder address.
- Added `RouterConfigError`, structured config issues, `validateRouterConfig`,
  `getRouterConfigIssues`, `x402AcceptsFromEnv`, `mppFromEnv`, and
  `paidOptionsForProtocols`.
- Wired structured config validation into `createRouter` while preserving the
  existing compatibility model: always throw for base URL / empty protocols;
  throw other config errors in production; keep development request-time errors.
- Added early checks for missing MPP secret/currency/RPC/default-store env,
  placeholder recipients, missing x402 payees, unsupported x402 networks, and
  missing CDP keys for strict validation.
- Added `ctx.payment` with explicit protocol, status, payer, amount, network,
  and best-effort recipient/transaction/receipt metadata.
- Added tests for config helpers, config issue reporting, MPP recipient
  inference, placeholder payees, and handler payment context.
- Updated README setup guidance and added a changeset.

Verification:

- `pnpm check` passes: format, lint, typecheck, build, and 238 tests.

## Open Questions

- Should the Stables-specific preset live in the main package root export, a
  subpath such as `@agentcash/router/stables`, or a separate package?
- Should strict env validation throw in development by default, or return clean
  per-protocol request-time errors as the current router does?
- What exact MPP refund capability exists or is planned? The router can expose
  compensation hooks now, but refund execution may belong outside the router.
- Should `preflight` replace `.validate()` over time, or remain a separate
  advanced API?
- Should route manifest generation be part of this package, or a separate CLI
  that can depend on Next-specific tooling?
