# CLAUDE.md — @agentcash/router

Protocol-agnostic route framework for Next.js App Router APIs with x402 payment, MPP payment, SIWX identity auth, and API key auth. Used by stablestudio, enrichx402, x402email, agentfacilitator, agentupload.

## Guiding Principles

1. **Route definition is 3-6 lines.** Everything else is derived.
2. **Single source of truth.** Route registry drives discovery, OpenAPI, pricing, Bazaar schemas.
3. **Auth and pricing are orthogonal and composable.** `.paid()`, `.siwx()`, `.apiKey()`, `.unprotected()`.
4. **Observability is pluggable via RouterPlugin.** Zero boilerplate.
5. **The package owns the x402 server lifecycle.** Init, verify, settle.
6. **Convention over configuration.** Sane defaults for Base, USDC, exact scheme.
7. **Compose, don't reimplement.** Zero payment/auth protocol logic — delegates to `@x402/*`, `@coinbase/x402`, and `mppx`.

## Architecture

**Orchestrate pipeline:** auth check -> body parse -> price resolve -> payment verify -> handler invoke -> settle -> finalize

- `src/orchestrate.ts` — Full request lifecycle orchestration
- `src/builder.ts` — Fluent RouteBuilder API
- `src/handler.ts` — Safe handler invocation with error mapping
- `src/types.ts` — Core types (RouteEntry, HandlerContext, HttpError)
- `src/registry.ts` — Route registry (Map-backed, silent overwrite on duplicate keys)
- `src/pricing.ts` — Price resolution (static, tiered, dynamic)
- `src/plugin.ts` — Plugin hook system
- `src/server.ts` — x402 server initialization
- `src/auth/` — Auth modules (siwx.ts, api-key.ts, nonce.ts)
- `src/protocols/` — Protocol handlers (x402.ts, detect.ts). MPP is handled via `mppx` high-level API (`Mppx.create` in index.ts)
- `src/discovery/` — Auto-generated endpoints (well-known.ts, openapi.ts)

## Auth Modes

Four auth modes, mutually exclusive (except `.apiKey()` composes with `.paid()`):

### `.paid(pricing)` — Payment required
```typescript
.paid('0.01')                    // Static price
.paid((body) => calcPrice(body)) // Dynamic pricing (body-driven, pre-handler)
.paid({ field: 'tier', tiers: { basic: { price: '0.01' } } }) // Tiered

// Handler-driven dynamic pricing — the handler bills in tick units via charge().
// One tick = `tickCost` USDC. Total billed = tickCost * sum(units).
.paid({ dynamic: true, tickCost: '0.0005', unitType: 'token', maxPrice: '0.10' })
```

#### Handler-driven dynamic (`.paid({ dynamic: true })`)

The handler receives a `charge()` callback. The invariant:

> **one `charge()` call === one tick === `tickCost` USDC === one route-defined unit**

The route picks `tickCost` to match its billing unit (one token at $0.0005,
one byte at $0.0000001, one frame at $0.001) and labels it via `unitType`.
The handler counts units in domain terms — call `charge()` once per unit.
Total billed is `tickCost * call_count`, capped at `maxPrice`.

```typescript
router
  .route('llm/generate')
  .paid({ dynamic: true, tickCost: '0.0005', unitType: 'token', maxPrice: '0.10' })
  .body(z.object({ prompt: z.string() }))
  .handler(async ({ body, charge }) => {
    const { tokens, output } = await callLLM(body.prompt);
    for (let i = 0; i < tokens; i++) await charge(); // bills tokens × $0.0005
    return { output };
  });
```

`tickCost` and `unitType` are per-route; they fall back to
`RouterConfig.mpp.session.tickCost`/`unitType` when unset.

**Streaming handlers** (`async function*`) bill via the same `charge()` API.
Yields are pure data flow — they do *not* auto-bill. Each `charge()` call
debits one voucher tick live; the handler can backpressure on
`payment-need-voucher` mid-stream:

```typescript
router
  .route('llm/stream')
  .paid({ dynamic: true, tickCost: '0.0001', unitType: 'token', maxPrice: '0.05', protocols: ['mpp'] })
  .body(z.object({ prompt: z.string() }))
  .handler(async function* ({ body, charge }) {
    for await (const token of streamLLM(body.prompt)) {
      await charge();        // one tick = one token; blocks on need-voucher
      yield token;
    }
    yield '[DONE]';            // free trailing event — no charge before it
  });
```

The same handler shape works on both x402 `upto` (settles cumulative atomic
amount; Permit2Proxy enforces ≤ maxPrice) and MPP sessions (per-tick voucher
debits; channel persists across requests). Streaming requires MPP — x402 has
no streaming primitive.

### `.siwx()` — Wallet identity required (no payment)
```typescript
.siwx().handler(async ({ wallet }) => { /* wallet is verified */ })
```

### `.apiKey(resolver)` — API key / Bearer token auth
For admin routes, cron jobs, internal services. Checks `X-API-Key` header OR `Authorization: Bearer <token>`.

```typescript
// Admin route with API key
export const GET = router
  .route('admin/users')
  .apiKey(async (key) => {
    const admin = await db.admin.findByKey(key);
    return admin ?? null; // null = 401, truthy = ctx.account
  })
  .handler(async ({ account }) => {
    // account is whatever resolver returned
    return db.user.findMany();
  });

// Cron job with static secret
export const POST = router
  .route('cron/cleanup')
  .apiKey((key) => key === process.env.CRON_SECRET ? { cron: true } : null)
  .handler(async () => { /* ... */ });
```

**Headers accepted:** `X-API-Key: <key>` or `Authorization: Bearer <key>`

**Composing with payment:** `.apiKey()` can layer on `.paid()` — auth runs first, payment second:
```typescript
.apiKey(resolver).paid('0.01') // Must pass API key AND pay
```

### `.unprotected()` — No auth
```typescript
.unprotected().handler(async () => { /* public endpoint */ })
```

## Pre-Payment Validation

### `.validate(fn)` — Async business validation before 402 challenge

For checks that need DB lookups or external APIs before showing a price. Runs after body parsing, before the 402 challenge. Requires `.body()`.

```typescript
// Domain registration with availability check
router
  .route('domain/register')
  .paid(calculatePrice, { maxPrice: '10.00' })
  .body(RegisterSchema)  // .body() before .validate() for type inference
  .validate(async (body) => {
    if (await isDomainTaken(body.domain)) {
      throw Object.assign(new Error('Domain already taken'), { status: 409 });
    }
  })
  .handler(async ({ body, wallet }) => {
    return registerDomain(body.domain, wallet);
  });

// Rate limiting before payment
router
  .route('api/expensive')
  .paid('1.00')
  .body(RequestSchema)
  .validate(async (body) => {
    const usage = await getUserUsage(body.userId);
    if (usage >= DAILY_LIMIT) {
      throw Object.assign(new Error('Daily limit reached'), { status: 429 });
    }
  })
  .handler(async ({ body }) => { ... });
```

**Pipeline order:** `body parse → validate → 402 challenge → payment → handler`

**Error handling:** Respects `.status` on thrown errors (default: 400). Use `Object.assign(new Error('msg'), { status: 409 })` for custom codes.

**Works with all auth modes:** paid, siwx, apiKey, unprotected.

## Critical Rules

- **Error handling:** Respect `.status` on any thrown error, not just `HttpError`. The `Object.assign(new Error(), { status })` pattern is universal in Node.js.
- **SIWX challenge:** Must return a proper x402v2 challenge with `PAYMENT-REQUIRED` header and JSON body containing `extensions['sign-in-with-x']` with `domain`, `uri`, `version`, `chainId`, `type`, `nonce`, `issuedAt`.
- **Discovery:** `authMode !== 'unprotected'` determines well-known visibility, not the protocol list. SIWX routes return 402 challenges and must be discoverable.
- **OpenAPI:** Merge paths for multi-method endpoints (GET + DELETE on same path). Never overwrite.
- **Duplicate route keys:** Registry silently overwrites (last-write-wins) with a dev-only `console.warn`. This is intentional — Next.js module loading order is non-deterministic during `next build`, so discovery stubs and real handlers may register the same key in either order. Prior art: ElysiaJS uses the identical pattern. See stablestudio `.claude/13_route-registry-dedup.md` for full research.
- **Dynamic pricing (v0.3.1+):** Early body parsing with `request.clone()` enables accurate dynamic pricing. `maxPrice` is optional and acts as a safety net (cap + fallback). Body is parsed before 402 challenge generation when pricing function exists. See `.claude/15_router-dynamic-pricing-solution.md` for full design and derisking.

## Environment Variables

### Base URL

`baseUrl` is **required** in `RouterConfig`. No auto-detection, no fallbacks. The realm is load-bearing for payment matching (MPP memo indexing, 402 challenge realm), so it must be explicitly set.

```typescript
createRouter({
  baseUrl: process.env.BASE_URL!,
  // ...
})
```

If `baseUrl` is missing, `createRouter` throws immediately — in dev and prod. This ensures devs discover the issue on first `pnpm dev` rather than deploying with a wrong realm.

### CDP API Keys

The router uses the default facilitator from `@coinbase/x402`, which requires CDP API keys in `process.env`:

- `CDP_API_KEY_ID` — Coinbase Developer Platform API key ID
- `CDP_API_KEY_SECRET` — CDP API key secret

**Critical for Next.js apps with env validation (T3 stack, `@t3-oss/env-nextjs`):** These variables must be explicitly declared in your env schema. Next.js does not automatically expose all env vars to `process.env` — undeclared vars are invisible at runtime.

### MPP (Tempo) Environment Variables

MPP payment verification requires an **authenticated** Tempo RPC endpoint. The public `https://rpc.tempo.xyz/` returns `401 Unauthorized`.

- `TEMPO_RPC_URL` — Authenticated Tempo RPC URL (e.g. `https://user:pass@rpc.mainnet.tempo.xyz`)

Alternatively, pass `rpcUrl` in the `mpp` config object to `createRouter()`. Without either, MPP on-chain verification fails with "unauthorized: authentication required".

### CDP Environment Variables

Without these keys, the default facilitator cannot authenticate with CDP:
- x402 server `initialize()` fails with "Failed to fetch supported kinds from facilitator: TypeError: fetch failed" or "Facilitator getSupported failed (401): Unauthorized"
- All payment routes return empty 402 responses (no `PAYMENT-REQUIRED` header, no body)

**Example env schema (T3/`@t3-oss/env-nextjs`):**

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    CDP_API_KEY_ID: z.string(),
    CDP_API_KEY_SECRET: z.string(),
    // ... other vars
  },
  runtimeEnv: {
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
    // ... other vars
  },
});
```

**Alternative:** Pass a custom facilitator config to `createRouter()` if you want to use a different facilitator URL or auth mechanism. But for most apps, the default CDP facilitator is correct.

## Version Stability

The public API is **not stable**. Downstream consumers should pin exact versions (`"@agentcash/router": "0.2.0"`, not `"^0.2.0"`). Breaking changes will happen as we build out multi-protocol support and discover patterns across services. Semver will be respected once we hit 1.0.

## Build & Test

```bash
pnpm build      # tsup
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
pnpm check      # format + lint + typecheck + build + test
```

## Development Record

The `.claude/` directory contains design docs, decision records, and bug analyses that document the reasoning behind the router's architecture. See `.claude/INDEX.md` for a table of contents.

**Convention:** Every doc has a `Status` header. When you resolve work described in a doc, update its Status to `Resolved in vX.Y.Z` and update INDEX.md.

## Releasing

This repo uses [changesets](https://github.com/changesets/changesets) for versioning and npm publishing.

### When doing work that should be released:

1. **Create a changeset** — Run `pnpm changeset` and describe the changes (patch/minor/major)
2. **Include the changeset file** in your PR (committed to `.changeset/`)
3. **Merge PR to main**

### What happens automatically:

1. When PRs with changesets merge to `main`, the `changesets/action` creates a **"chore: version packages"** PR that bumps `package.json` version and updates `CHANGELOG.md`
2. When that version PR is merged, the action **publishes to npm** automatically

### Troubleshooting

- **Publish fails**: Check `NPM_TOKEN` secret is set and has write access to `@agentcash` scope
- **No version PR created**: Ensure your PR included a `.changeset/*.md` file
