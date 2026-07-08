# AGENTS.md

Guidance for AI agents working on `@agentcash/router`.

## What this is

A protocol-agnostic route framework with a framework-agnostic core: routes are Web-standard `Request`/`Response` handlers dispatched through an embedded Hono app. Hosts on Next.js (per-file, or a single catch-all via `@agentcash/router/next`), Hono, Bun, or any fetch runtime through `router.fetch` / `router.hono()`. Provides x402 payments, MPP payments, SIWX identity auth, and API key auth behind a single fluent builder. A route definition is 3 to 6 lines; everything else (pricing, discovery, OpenAPI, settlement) is derived.

## Guiding principles

1. Route definition is 3 to 6 lines.
2. Single source of truth: the route registry drives discovery, OpenAPI, and pricing.
3. Pricing modes (`.paid()`, `.upTo()`, `.session()`) and identity auth (`.siwx()`, `.apiKey()`) compose; `.unprotected()` opts out. Exactly one pricing mode per route.
4. Observability is pluggable via `RouterPlugin`. No boilerplate.
5. The package owns x402 and MPP server lifecycles (init, verify, settle).
6. Compose, do not reimplement. Delegate to `@x402/*`, `@coinbase/x402`, and `mppx`.

## Layout

```
src/
  index.ts              public surface — createRouter / createRouterFromEnv
  builder.ts            fluent RouteBuilder (.paid / .upTo / .session / .siwx / .apiKey / .unprotected)
  registry.ts           Map-backed route registry
  constants.ts          network ids, USDC asset/decimals, default facilitator
  types.ts              core types (RouteEntry, HandlerContext, HttpError, PaidOptions, UpToOptions, SessionOptions)
  plugin/               RouterPlugin types + lifecycle dispatch
  init/                 protocol init (x402.ts, x402-server.ts, mpp.ts, mppx.ts)
  protocols/            x402/ and mpp/ strategies, detect.ts, accepts
  auth/                 siwx.ts, api-key.ts, normalize-wallet.ts
  kv-store/             one KvStore backs siwx nonce, siwx entitlement, mpp replay
  pricing/              fixed, tiered, dynamic (args-derived), upto-charge, metered-charge, format (atomic conversion)
  pipeline/             orchestrate.ts + steps/ + flows/ (paid → static-paid | dynamic-paid; siwx-only, api-key-only, unprotected)
  discovery/            openapi, llms-txt, well-known (deprecated surface), not-found
  config/               RouterConfig + env schema (single source of truth), RouterConfigError, issue codes
```

## Pipeline

`auth check -> body parse -> validate -> 402 challenge -> payment verify -> handler -> settle -> finalize`

The `body parse -> validate -> 402 challenge` prefix only holds when the challenge needs the body: args-derived/tiered pricing, `.validate()`, or a checkout session (`shouldParseBodyEarly`). On other paid routes a bare unpaid probe gets its 402 without the body being inspected (malformed body ⇒ 402, not 400); the paying retry parses and validates before verify/settle, so a 400 never charges the caller.

Paid `.paid()` routes may set `mpp: { settleBeforeHandler: true }` (or chain `.mpp({ settleBeforeHandler: true })` on auto-priced routes) to broadcast MPP transaction (pull) credentials at verify instead of after the handler. x402 on the same route is unaffected. MPP hash (push) credentials already settle at verify. Use `.settlement({ onSettledHandlerError })` when eager MPP settle can charge before an upstream failure.

## Naming

Two constructor-verb families, split by audience:

- `create<Noun>` — public, top-level factories that return long-lived objects: `createRouter`, `createRouterFromEnv`, `createRequestHandler`, `createUptoChargeContext`.
- `build<Noun>` — internal, per-request assembly of protocol payloads and contexts: one verb, one domain noun, named after the domain concept, never after an HTTP status code or transport detail (the function that builds a payment challenge is `buildChallengeResponse`, not `build402`). The challenge family shares the `Challenge` backbone: `buildChallengeResponse`, `buildChallengeExtensions`, `buildSiwxChallenge`, `buildSessionChallenge`, `buildX402Challenge`.

Pipeline steps use `run<Noun>` (executes and may answer the request), `resolve<Noun>` (computes a value), or `try<Noun>` (optional fast path returning null to continue).

## Critical rules

- **Error handling.** Respect `.status` on any thrown error, not just `HttpError`. Pattern: `throw Object.assign(new Error('msg'), { status: 409 })`. Three typed error classes, by phase: `RouterConfigError` (router construction), `RouteDefinitionError` (route registration, thrown at module-import time — never a JSON response), `HttpError` (request time, becomes a structured JSON response). New registration-time guards must throw `RouteDefinitionError`, not plain `Error`.
- **SIWX challenge.** Must return an x402v2 challenge with a `PAYMENT-REQUIRED` header and a JSON body whose `extensions['sign-in-with-x']` carries `info` (an object with `domain`, `uri`, `version`, `chainId`, `type`, `nonce`, `issuedAt`, `expirationTime`, `statement`), `supportedChains`, and an optional `schema`. The header-encoded challenge and the JSON body must stay identical.
- **Discovery visibility.** `authMode !== 'unprotected'` determines discovery visibility (OpenAPI `x-payment-info` and the deprecated well-known listing), not the protocol list. SIWX routes are discoverable. All three pricing modes set `authMode = 'paid'`; the `billing` field (`'exact' | 'upto' | 'metered'`) distinguishes them downstream.
- **`.wellKnown()` is deprecated as a discovery recommendation.** The `/.well-known/x402` handler keeps working for legacy x402 clients (do not remove the logic), but never recommend it in docs, examples, or the 404 rediscovery hint — the recommended surfaces are `/openapi.json` and `/llms.txt`.
- **OpenAPI.** Merge paths for multi-method endpoints (GET + DELETE on same path). Never overwrite.
- **Duplicate route keys.** Registry silently overwrites (last write wins) with a dev-only `console.warn`. This is intentional: Next.js module load order is non-deterministic, so stub + real handler may register either order.
- **Args-derived pricing.** Body is parsed before the 402 challenge via `request.clone()` when `.paid(fn)` is used. `maxPrice` is optional: it caps the computed amount and acts as a fallback on non-`HttpError` exceptions; `HttpError` is always rethrown so a pricing function can reject the request with its intended status before any payment is taken.
- **`.upTo()` is x402-only.** Builder throws if `protocols` overrides it to anything else. Requires an `'upto'` accept on at least one configured x402 network — `createRouterFromEnv` auto-adds one on Base; programmatic `createRouter` users must add `{ scheme: 'upto', network, asset }` to `x402.accepts` themselves.
- **`.session()` is MPP-only.** (`.metered()` is a deprecated alias.) Builder throws if `protocols` overrides it to anything else. Requires `RouterConfig.mpp.session` and `mpp.operatorKey`. `createRouterFromEnv` enables both automatically when `MPP_OPERATOR_KEY` is set.
- **MPP operator vs fee-payer.** `mpp.operatorKey` and `mpp.feePayerKey` MUST resolve to different addresses. Tempo rejects fee-delegated txs where `sender === feePayer`. `createRouter` validates this at construction and throws `mpp_operator_equals_fee_payer`.
- **MPP operator address.** Must equal `recipient` / payee. mppx's close handler asserts `sender === payee` on settle.
- **Streaming requires `.session()`.** `.stream()` on a `.paid()` / `.upTo()` / `.unprotected()` route throws at registration. x402 has no streaming primitive, so `.stream()` is MPP-only by construction.
- **Builder invariants are enforced twice.** Every mutual-exclusion rule above is a compile-time `RouteError<'…'>` (via the `Ident`/`Bill` phantom generics in `builder.ts`) *and* a registration-time throw (for JS consumers). When adding or changing a rule, update both, plus the type tests in `tests/builder.test-d.ts` and the runtime tests in `tests/builder.test.ts`. Type tests run via vitest's typecheck pass (`pnpm test`), not `pnpm typecheck` — `tsconfig.json` excludes `tests/`.
- **`.method()` is discovery-only.** The exported const name (`GET`/`POST`) controls what Next.js serves; `.method()` controls what discovery output advertises. Default is `POST` (`GET` when `.query()` is used) — GET routes without `.query()` must chain `.method('GET')` or discovery advertises the wrong verb.
- **`X-Agent-Identity`.** Every 402 carries an optional DID-auth challenge header (`src/auth/agent-identity.ts`, `did-auth-challenge` package). Clients may return a signed proof; the verified DID surfaces as `ctx.actor`. Never gates a request; independent of SIWX and payment.

## Two entry points

Two ways to initialize, both publicly exported:

- **`createRouterFromEnv(options)`** — paved road. Reads `process.env`, validates every value, throws a single `RouterConfigError` with all problems at once. Auto-emits `exact` + `upto` accepts on Base, auto-adds Solana when `SOLANA_PAYEE_ADDRESS` is set, auto-enables MPP session mode when `MPP_OPERATOR_KEY` is set.
- **`createRouter(config)`** — lower-level. Caller passes a fully-built `RouterConfig`. Use when env doesn't cover the case (custom networks, multi-payee setups, non-standard assets, fully programmatic configs).

Implementation: `createRouterFromEnv(options)` ≡ `createRouter(routerConfigFromEnv(options))`. `routerConfigFromEnv` is also exported, so consumers who want "env-derived base + programmatic tweaks" can spread the result and override fields before passing to `createRouter`.

## Environment variables

`src/config/schema.ts` is the single source of truth — `envShape` declares every var the router reads (each field's `.refine(...)` carries both the shape check and the user-facing description). `ENV_KEYS` is derived from it. README and `.env.example` are drift-tested against `ENV_KEYS` (see `tests/env-drift.test.ts`); when adding/renaming an env var, edit `schema.ts` and the two user-facing docs together.

## Build and test

```bash
pnpm build       # tsup
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm check       # format + lint + typecheck + build + test
```

## Releasing

Uses [changesets](https://github.com/changesets/changesets).

1. `pnpm changeset`, describe the change (patch / minor / major).
2. Commit the changeset file with the PR.
3. On merge to `main`, the action opens a "chore: version packages" PR.
4. Merging the version PR publishes to npm.

Troubleshooting: publish needs `NPM_TOKEN` with write access to `@agentcash`. Version PR not created means no `.changeset/*.md` in the merged PR.
