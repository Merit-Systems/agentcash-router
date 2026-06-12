# AGENTS.md

Guidance for AI agents working on `@agentcash/router`.

## What this is

A protocol-agnostic route framework for Web-standard APIs. Provides x402 payments, MPP payments, SIWX identity auth, and API key auth behind a single fluent builder. The core speaks plain `Request`/`Response` and dispatches through an embedded Hono app; Next.js (catch-all via `@agentcash/router/next`, or per-file route exports) and Hono are supported out of the box. A route definition is 3 to 6 lines; everything else (pricing, discovery, OpenAPI, settlement, chaining) is derived.

## Guiding principles

1. Route definition is 3 to 6 lines.
2. Single source of truth: the route registry drives discovery, OpenAPI, and pricing.
3. Pricing modes (`.paid()`, `.upTo()`, `.metered()`) and identity auth (`.siwx()`, `.apiKey()`) compose; `.unprotected()` opts out. Exactly one pricing mode per route.
4. Observability is pluggable via `RouterPlugin`. No boilerplate.
5. The package owns x402 and MPP server lifecycles (init, verify, settle).
6. Compose, do not reimplement. Delegate to `@x402/*`, `@coinbase/x402`, and `mppx`.

## Layout

```
src/
  index.ts              public surface — createRouter / createRouterFromEnv; embedded Hono app, router.fetch / router.hono
  next.ts               @agentcash/router/next — nextHandlers(router) for the Next.js catch-all
  builder.ts            fluent RouteBuilder (.paid / .upTo / .metered / .siwx / .apiKey / .unprotected / .nextStep)
  registry.ts           Map-backed route registry + request-time dispatch (last-write-wins)
  path-params.ts        {param} template ↔ Hono :param conversion + the one shared param matcher
  constants.ts          network ids, USDC asset/decimals, default facilitator
  types.ts              core types (RouteEntry, HandlerContext, HttpError, PaidOptions, NextStepConfig, …)
  plugin/               RouterPlugin types + lifecycle dispatch
  init/                 protocol init (x402.ts, x402-server.ts, mpp.ts, mppx.ts)
  protocols/            x402/ and mpp/ strategies, detect.ts, accepts
  auth/                 siwx.ts, api-key.ts, normalize-wallet.ts
  kv-store/             one KvStore backs siwx nonce, siwx entitlement, mpp replay; update() is atomic CAS
  pricing/              fixed, tiered, dynamic (args-derived), upto-charge, metered-charge, format (atomic conversion)
  pipeline/             orchestrate.ts + steps/ (context, body, auth, settle, respond) + flows/
                        (paid → static-paid | dynamic-paid over shared resolve-paid-request; siwx-only,
                        api-key-only, unprotected) + next-step.ts (.nextStep() resolution + workflow chains)
  discovery/            well-known, openapi, llms-txt; utils/workflows.ts composes guidance + the
                        deduped nextStep workflow map for llms.txt AND OpenAPI info.x-guidance
  config/               RouterConfig + env schema (single source of truth), RouterConfigError, issue codes
```

## Pipeline

`auth check -> body parse -> validate -> 402 challenge -> payment verify -> handler -> settle -> finalize`

## Naming

Constructor-style functions use `build<Noun>` — one verb, one domain noun. Name them after the domain concept, never after an HTTP status code or transport detail (the function that builds a payment challenge is `buildChallengeResponse`, not `build402`). The challenge family shares the `Challenge` backbone: `buildChallengeResponse`, `buildChallengeExtensions`, `buildSiwxChallenge`, `buildSessionChallenge`, `buildX402Challenge`.

## Critical rules

- **Error handling.** Respect `.status` on any thrown error, not just `HttpError`. Pattern: `throw Object.assign(new Error('msg'), { status: 409 })`.
- **SIWX challenge.** Must return an x402v2 challenge with a `PAYMENT-REQUIRED` header and a JSON body whose `extensions['sign-in-with-x']` carries `info` (an object with `domain`, `uri`, `version`, `chainId`, `type`, `nonce`, `issuedAt`, `expirationTime`, `statement`), `supportedChains`, and an optional `schema`. The header-encoded challenge and the JSON body must stay identical.
- **Discovery visibility.** `authMode !== 'unprotected'` determines well-known visibility, not the protocol list. SIWX routes are discoverable. All three pricing modes set `authMode = 'paid'`; the `billing` field (`'exact' | 'upto' | 'metered'`) distinguishes them downstream.
- **OpenAPI.** Merge paths for multi-method endpoints (GET + DELETE on same path). Never overwrite.
- **Duplicate route keys.** Registry silently overwrites (last write wins) with a dev-only `console.warn`. This is intentional: Next.js module load order is non-deterministic, so stub + real handler may register either order.
- **Args-derived pricing.** Body is parsed before the 402 challenge via `request.clone()` when `.paid(fn)` is used. `maxPrice` is optional: it caps the computed amount and acts as a fallback on non-`HttpError` exceptions; `HttpError` is always rethrown so a pricing function can reject the request with its intended status before any payment is taken.
- **`.upTo()` is x402-only.** Builder throws if `protocols` overrides it to anything else. Requires an `'upto'` accept on at least one configured x402 network — `createRouterFromEnv` auto-adds one on Base; programmatic `createRouter` users must add `{ scheme: 'upto', network, asset }` to `x402.accepts` themselves.
- **`.metered()` is MPP-only.** Builder throws if `protocols` overrides it to anything else. Requires `RouterConfig.mpp.session` and `mpp.operatorKey`. `createRouterFromEnv` enables both automatically when `MPP_OPERATOR_KEY` is set.
- **MPP operator vs fee-payer.** `mpp.operatorKey` and `mpp.feePayerKey` MUST resolve to different addresses. Tempo rejects fee-delegated txs where `sender === feePayer`. `createRouter` validates this at construction and throws `mpp_operator_equals_fee_payer`.
- **MPP operator address.** Must equal `recipient` / payee. mppx's close handler asserts `sender === payee` on settle.
- **Streaming requires `.metered()`.** `.stream()` on a `.paid()` / `.upTo()` / `.unprotected()` route throws at registration. x402 has no streaming primitive, so `.stream()` is MPP-only by construction.
- **Hono dispatch goes through the registry at request time.** The embedded app binds `key:method` → `registry.dispatch(...)`, never a handler closure, so re-registration keeps last-write-wins. Mount each key+method once (`onFirstRegister`).
- **`.nextStep()` injection rules.** The `next` array is appended only to 2xx plain-object JSON results; a handler-supplied `next` key always wins; `when()`/`args()`/`external()` exceptions and unregistered targets report `warn` and skip — they must never break the response. For route-form steps everything advertised (method, auth, price) derives from the target's `RouteEntry` at resolution time; `registry.validate()` asserts route targets exist. `args()` receives `(result, { body, query, params })` — the request context lets a chain reuse caller-sent values (threaded from `finalize`).
- **External steps skip, never break.** `{ external: (result) => ExternalRequest | null }` advertises a third-party successor (e.g. presigned-S3 PUT) as `{ external: true, method, url, headers?, body? }` — never with `auth`/`price` (unknowable for third-party hosts). `null`/`undefined` skips the entry; exceptions report `warn` and skip. Exactly one of `route`/`external` per step (compile-time union + registration throw). In the workflows map an external step is a terminal line — there is no registry target to traverse.
- **The response body is the single chaining channel.** Do not reintroduce static chain copies (`x-next`, OpenAPI `links`, well-known `workflows` — all deliberately removed): chains are dynamic (result-resolved URLs, `when()` filtering, current prices) and a static copy is strictly staler. The map-level `## Workflows` summary rides the guidance channel into BOTH llms.txt and OpenAPI `info.x-guidance` (consumer pipelines read guidance only from `x-guidance`), via the shared composer in `discovery/utils/workflows.ts` — which dedupes isomorphic chains (identical step sequences, URLs differing only at the root) into one representative annotated with the count, and renders at most 12 distinct groups. well-known `instructions` stays RAW guidance — nothing consumes well-known; do not grow it. OpenAPI's only other trace is the optional `next` key auto-added to advertised output schemas.
- **`.docs()` never reaches the 402 challenge.** `.description()` is the single short sentence shared by the 402 challenge `resource.description` (≤400 chars on paid x402 routes), OpenAPI `summary`, and discovery one-liners. `.docs()` is unbounded long-form operation documentation emitted ONLY as the OpenAPI operation `description` — never the 402 challenge, well-known, or llms.txt (llms.txt is the map; docs are node-level detail fetched on demand).
- **`KvStore.update()` must be atomic.** It backs mppx channel deductions. The built-in Upstash REST store does compare-and-set via Lua `EVAL` (TTL-preserving) and may re-run `fn` on conflict; custom stores must honor the same contract (documented on the interface).
- **x402 settle retry is classified.** `x402/strategy.ts` retries thrown transients and `success:false` responses but fails fast on a conservative non-retryable `errorReason` set; post-throw nonce-reuse is reported as possible double-settle ambiguity, never invented as success.
- **Function-form `payTo` receives `(request, body, network)`.** The network argument lets one callback route payouts per chain; don't collapse it.

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
