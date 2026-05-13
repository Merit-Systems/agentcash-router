<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://agentcash.dev/logo-dark-striped.svg">
    <img alt="AgentCash" src="https://agentcash.dev/logo-light-striped.svg" width="360">
  </picture>
</p>

<h1 align="center">@agentcash/router</h1>

<p align="center">
  <strong>The fastest way to ship an API on x402 and MPP.</strong><br/>
  x402 and MPP payments, compatible discovery, and minimal boilerplate. With @agentcash/router, agents on <a href="https://agentcash.dev">AgentCash</a> and across the agentic commerce ecosystem are compatible and call your endpoints from day one.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agentcash/router"><img alt="npm" src="https://img.shields.io/npm/v/@agentcash/router.svg?color=111&label=npm"></a>
  <a href="https://agentcash.dev/docs"><img alt="docs" src="https://img.shields.io/badge/docs-agentcash.dev-111"></a>
  <a href="#install"><img alt="next.js" src="https://img.shields.io/badge/Next.js-App%20Router-111"></a>
</p>

---

## Install

```bash
pnpm add @agentcash/router
pnpm add next zod @x402/core @x402/evm @x402/extensions @coinbase/x402 zod-openapi # peer dependencies
pnpm add mppx  # optional, for MPP support
```

## Environment

The recommended entry point reads its config from `process.env`. A copy-paste `.env.example` lives at the repo root.

### x402

| Var | Required | Purpose |
|-----|----------|---------|
| `EVM_PAYEE_ADDRESS` | yes | EVM address that receives x402 and MPP payments (`0x…`, 20 bytes). Canonicalized to lowercase. The zero address is rejected. |
| `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | yes (production) | Coinbase Developer Platform credentials for the default EVM facilitator. T3 / `@t3-oss/env-nextjs` users must declare these in their env schema. |

### Solana

| Var | Required | Purpose |
|-----|----------|---------|
| `SOLANA_PAYEE_ADDRESS` | no | When set, adds a Solana `exact` accept so the router takes Solana payments. **Dynamic pricing (`upto`) is Base-only** — Solana clients can only pay static-priced routes. |
| `SOLANA_FACILITATOR_URL` | no | Override the Solana x402 facilitator. Defaults to `DEFAULT_SOLANA_FACILITATOR_URL`. |

### MPP (auto-enabled when `MPP_SECRET_KEY` is set)

| Var | Required | Purpose |
|-----|----------|---------|
| `MPP_SECRET_KEY` | when MPP is enabled | Server-side MPP secret. Presence toggles MPP on. |
| `MPP_CURRENCY` | when MPP is enabled | Tempo currency address. Use `TEMPO_USDC_ADDRESS` for Tempo USDC. |
| `TEMPO_RPC_URL` | when MPP is enabled | Authenticated Tempo JSON-RPC endpoint. Public `rpc.tempo.xyz` returns 401. |
| `MPP_OPERATOR_KEY` | no | Signs server-side close/settle. When set, MPP session mode is enabled automatically (required for streaming + `.paid({ dynamic: true })` on MPP). Address must equal the payee. |
| `MPP_FEE_PAYER_KEY` | no | Sponsors client gas for channel open/topUp. Must resolve to a different address than `MPP_OPERATOR_KEY` (Tempo rejects fee-delegated txs where `sender === feePayer`). |

### Other

| Var | Required | Purpose |
|-----|----------|---------|
| `BASE_URL` | yes | Origin URL (`https://api.example.com`). Load-bearing — used as the 402 realm, OpenAPI server URL, and MPP memo prefix. Must match the public domain. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no | Upstash / Vercel KV. Backs SIWX nonce, SIWX entitlement, and MPP replay. In-memory fallback is unsafe in serverless production. Providing a Kv Store is highly recommended. |

## Quick start

### 1. Create the router

There are two ways to initialize. Pick one.

**Option A — `createRouterFromEnv` (recommended).** Reads `process.env`, validates every value up front, and throws a single `RouterConfigError` with every problem at once. Auto-enables MPP when `MPP_SECRET_KEY` is set, auto-adds a Solana accept when `SOLANA_PAYEE_ADDRESS` is set, auto-enables MPP session mode when `MPP_OPERATOR_KEY` is set.

```typescript
// lib/router.ts
import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'My API',
  description: 'Pay-per-call search.',
  guidance: 'POST /search with { q: string }. Returns top 10 results.',
});
```

**Option B — build a `RouterConfig` and pass it to `createRouter`.** Use this when you need custom networks, multiple payees, non-standard assets, or any setting `createRouterFromEnv` doesn't expose. `createRouter` runs the same validation against the `RouterConfig` shape.

```typescript
// lib/router.ts
import { createRouter, BASE_MAINNET_NETWORK } from '@agentcash/router';

export const router = createRouter({
  baseUrl: 'https://api.example.com',
  payeeAddress: '0x…',
  network: BASE_MAINNET_NETWORK,
  protocols: ['x402'],
  x402: { accepts: [/* … */] },
  discovery: {
    title: 'My API',
    version: '1.0.0',
    description: 'Pay-per-call search.',
    guidance: 'POST /search with { q: string }. Returns top 10 results.',
  },
});
```

### 2. Define routes

```typescript
// app/api/search/route.ts
import { router } from '@/lib/router';
import { searchSchema } from '@/lib/schemas';

export const POST = router.route({ path: 'search' })
  .paid('0.01')
  .body(searchSchema)
  .handler(async ({ body }) => search(body));
```

```typescript
// app/api/inbox/status/route.ts
export const GET = router.route({ path: 'inbox/status' })
  .siwx()
  .handler(async ({ wallet }) => getStatus(wallet));
```

```typescript
// app/api/health/route.ts
export const GET = router.route({ path: 'health' })
  .unprotected()
  .handler(async () => ({ status: 'ok' }));
```

### 3. Auto-discovery

```typescript
// app/openapi.json/route.ts
import { router } from '@/lib/router';
import '@/lib/routes-barrel';  // imports every route module so the registry is populated
export const GET = router.openapi();
```

The barrel forces every route module to load before the discovery handler walks the registry — Next.js otherwise lazy-loads route files on first hit, and unloaded routes don't appear in the spec.

## Auth modes

| Method | Purpose |
|--------|---------|
| `.paid(price)` | Payment required (x402, MPP, or both). |
| `.siwx()` | Wallet identity, no payment. Returns 402 with a SIWX challenge. |
| `.apiKey(resolver)` | `X-API-Key` or `Authorization: Bearer <key>`. Composes with `.paid()`. |
| `.unprotected()` | No auth. |

```typescript
router.route({ path: 'admin/users' })
  .apiKey(async (key) => db.admin.findByKey(key))  // null => 401
  .handler(async ({ account }) => db.user.findMany());

router.route({ path: 'gated' })
  .apiKey(resolver).paid('0.01')  // key AND payment
  .handler(fn);
```

## Pricing

**Static.**
```typescript
.paid('0.02')
```

**Args-driven.**
```typescript
.paid((body) => calculateCost(body), { maxPrice: '5.00' })
.body(genSchema)
```

`maxPrice` caps the computed amount and acts as a fallback if the pricing function throws. Without `maxPrice`, the route trusts your function fully (no cap, no fallback) and returns 500 on errors.

**Tiered.**
```typescript
.paid({
  field: 'tier',
  tiers: {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
  },
})
.body(uploadSchema)
```

**Handler-driven (request-mode).** Bills exactly `tickCost` per request:
```typescript
.paid({ dynamic: true, tickCost: '0.01', unitType: 'request', maxPrice: '0.01' })
.handler(async ({ body }) => { ... });
```

**Streaming (MPP only).** One `charge()` call bills one tick:
```typescript
.paid({ dynamic: true, tickCost: '0.0001', unitType: 'token', maxPrice: '0.05', protocols: ['mpp'] })
.stream(async function* ({ body, charge }) {
  for await (const token of streamLLM(body.prompt)) {
    await charge();
    yield token;
  }
});
```

## Pre-payment validation

For checks that need a DB lookup before quoting a price:

```typescript
router.route({ path: 'domain/register' })
  .paid(calculatePrice, { maxPrice: '10.00' })
  .body(RegisterSchema)
  .validate(async (body) => {
    if (await isDomainTaken(body.domain)) {
      throw Object.assign(new Error('Domain taken'), { status: 409 });
    }
  })
  .handler(async ({ body, wallet }) => registerDomain(body.domain, wallet));
```

Pipeline order: `body parse -> validate -> 402 challenge -> payment -> handler`.

## Plugin Hooks

```typescript
import { createRouterFromEnv, type RouterPlugin } from '@agentcash/router';

const myPlugin: RouterPlugin = {
  onRequest(meta) {},
  onPaymentVerified(ctx, payment) {},
  onPaymentSettled(ctx, settlement) {},
  onResponse(ctx, response) {},
  onError(ctx, error) {},
  onAlert(ctx, alert) {},
};

export const router = createRouterFromEnv({
  title: 'My API',
  description: '…',
  guidance: '…',
  plugin: myPlugin,
});
```

All hooks are optional and fire-and-forget; they never delay the response. Use hooks to add additional telemetry or flexibility to your resource's lifecycle.

