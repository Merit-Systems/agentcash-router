# AGENTS.md

Guidance for AI agents working on `@agentcash/router`.

## What this is

A protocol-agnostic route framework for Next.js App Router APIs. Provides x402 payments, MPP payments, SIWX identity auth, and API key auth behind a single fluent builder. A route definition is 3 to 6 lines; everything else (pricing, discovery, OpenAPI, settlement) is derived.

## Guiding principles

1. Route definition is 3 to 6 lines.
2. Single source of truth: the route registry drives discovery, OpenAPI, and pricing.
3. Auth and pricing are orthogonal: `.paid()`, `.siwx()`, `.apiKey()`, `.unprotected()`.
4. Observability is pluggable via `RouterPlugin`. No boilerplate.
5. The package owns x402 and MPP server lifecycles (init, verify, settle).
6. Compose, do not reimplement. Delegate to `@x402/*`, `@coinbase/x402`, and `mppx`.

## Layout

```
src/
  index.ts              public surface — createRouter / createRouterFromEnv
  builder.ts            fluent RouteBuilder
  registry.ts           Map-backed route registry
  constants.ts          network ids, USDC asset/decimals, default facilitator
  types.ts              core types (RouteEntry, HandlerContext, HttpError)
  plugin/               RouterPlugin types + lifecycle dispatch
  init/                 protocol init (x402.ts, mpp.ts) + env reader (from-env.ts)
  protocols/            x402/ and mpp/ strategies, detect.ts, accepts
  auth/                 siwx.ts, api-key.ts, normalize-wallet.ts
  kv-store/             one KvStore backs siwx nonce, siwx entitlement, mpp replay
  pricing/              fixed, tiered, dynamic, atomic conversion
  pipeline/             flows (paid, siwx-only, api-key-only, unprotected)
  discovery/            well-known, openapi, llms-txt
  config/               RouterConfig validation, RouterConfigError, issue codes
```

## Pipeline

`auth check -> body parse -> validate -> 402 challenge -> payment verify -> handler -> settle -> finalize`

## Critical rules

- **Error handling.** Respect `.status` on any thrown error, not just `HttpError`. Pattern: `throw Object.assign(new Error('msg'), { status: 409 })`.
- **SIWX challenge.** Must return an x402v2 challenge with `PAYMENT-REQUIRED` header and a JSON body whose `extensions['sign-in-with-x']` has `domain`, `uri`, `version`, `chainId`, `type`, `nonce`, `issuedAt`.
- **Discovery visibility.** `authMode !== 'unprotected'` determines well-known visibility, not the protocol list. SIWX routes are discoverable.
- **OpenAPI.** Merge paths for multi-method endpoints (GET + DELETE on same path). Never overwrite.
- **Duplicate route keys.** Registry silently overwrites (last write wins) with a dev-only `console.warn`. This is intentional: Next.js module load order is non-deterministic, so stub + real handler may register either order.
- **Dynamic pricing.** Body is parsed before the 402 challenge via `request.clone()` when pricing is a function. `maxPrice` is optional and acts as a cap and a fallback on pricing function errors.
- **MPP operator vs fee-payer.** `mpp.operatorKey` and `mpp.feePayerKey` MUST resolve to different addresses. Tempo rejects fee-delegated txs where `sender === feePayer`. `createRouter` validates this at construction and throws `mpp_operator_equals_fee_payer`.
- **MPP operator address.** Must equal `recipient` / payee. mppx's close handler asserts `sender === payee` on settle.
- **Streaming requires MPP.** `.stream()` only works on MPP. x402 has no streaming primitive.

## Two entry points

`createRouterFromEnv` is the paved road: reads `process.env`, validates every value, throws a single `RouterConfigError` with all problems at once. Auto-emits `exact` + `upto` accepts on Base, auto-adds Solana when `SOLANA_PAYEE_ADDRESS` is set, auto-enables MPP session mode when `MPP_OPERATOR_KEY` is set.

```typescript
import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'My API',
  description: 'Pay-per-call search.',
  guidance: '...',
});
```

`createRouter` is the lower-level entry point. Use it when the caller needs to build `RouterConfig` programmatically (custom networks, multi-payee setups, non-standard assets). `routerConfigFromEnv` exposes the env-reading step on its own when the caller wants to inspect or augment the config before instantiation.

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
