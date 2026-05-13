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
  builder.ts            fluent RouteBuilder
  orchestrate.ts        request lifecycle wiring
  handler.ts            safe handler invocation
  registry.ts           Map-backed route registry
  types.ts              core types (RouteEntry, HandlerContext, HttpError)
  server.ts             x402 server bootstrap
  plugin.ts             RouterPlugin types + consolePlugin
  init/                 protocol init (x402.ts, mpp.ts)
  protocols/            x402/ and mpp/ strategies, detect.ts
  auth/                 siwx.ts, api-key.ts, normalize-wallet.ts
  kv-store/             one KvStore backs siwx nonce, siwx entitlement, mpp replay
  pricing/              fixed, tiered, dynamic, atomic conversion
  pipeline/             flows (paid, siwx-only, api-key-only, unprotected)
  discovery/            well-known, openapi, llms-txt
  config/               validation + env helpers
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

## Required config

```typescript
createRouter({
  baseUrl: process.env.BASE_URL!,         // required, no fallback
  payeeAddress: process.env.WALLET!,      // payee for x402
  discovery: { title, version },          // required, drives OpenAPI / llms.txt
  protocols: ['x402'],                    // or ['x402', 'mpp']
  mpp: mppFromEnv(process.env),           // optional
  plugin: consolePlugin(),                // optional
  strictRoutes: true,                     // recommended
});
```

`baseUrl` is load-bearing: it sets the MPP realm and the OpenAPI server URL. Missing `baseUrl` throws in every environment, dev and prod.

## Environment variables

| Var | Purpose |
|-----|---------|
| `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | Default `@coinbase/x402` facilitator auth. T3 / `@t3-oss/env-nextjs` users must declare these in their env schema. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash / Vercel KV. If both set, an Upstash REST client is auto-wired into all three stores. Missing either falls back to in-memory (unsafe in serverless production). |
| `TEMPO_RPC_URL` | Authenticated Tempo RPC. Public `rpc.tempo.xyz` returns 401. |
| `MPP_SECRET_KEY`, `MPP_CURRENCY`, `MPP_OPERATOR_KEY`, `MPP_FEE_PAYER_KEY` | MPP server config. Use `mppFromEnv(process.env)` to assemble. |

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
