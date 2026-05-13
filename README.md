# @agentcash/router

Fluent route builder for Next.js App Router APIs with x402 payments, MPP payments, SIWX authentication, and API key auth. A route is 3 to 6 lines; pricing, discovery, OpenAPI, and settlement are derived.

## Install

```bash
pnpm add @agentcash/router
pnpm add next zod @x402/core @x402/evm @x402/extensions @coinbase/x402 zod-openapi
pnpm add mppx  # optional, for MPP support
```

## Environment

The recommended entry point reads its config from `process.env`. Set the vars below; everything else is derived.

### Required

| Var | Purpose |
|-----|---------|
| `BASE_URL` | Your production origin (`https://api.example.com`). Load-bearing — used as the 402 realm, OpenAPI server URL, and MPP memo prefix. Must match the public domain. |
| `X402_WALLET_ADDRESS` | EVM payee for x402 payments (`0x…`, 20 bytes). |

### Optional

| Var | Default | Purpose |
|-----|---------|---------|
| `SOLANA_PAYEE_ADDRESS` | _(none)_ | When set, adds a Solana `exact` accept so the router takes Solana payments. |
| `SOLANA_FACILITATOR_URL` | `DEFAULT_SOLANA_FACILITATOR_URL` | x402 Solana facilitator endpoint. |
| `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | _(required in production)_ | Coinbase EVM facilitator credentials. T3 / `@t3-oss/env-nextjs` users must declare these in their env schema. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | _(in-memory fallback)_ | Upstash / Vercel KV. Used for SIWX nonce, SIWX entitlement, and MPP replay. In-memory fallback is unsafe in serverless production. |

### MPP (auto-enabled when `MPP_SECRET_KEY` is set)

| Var | Purpose |
|-----|---------|
| `MPP_SECRET_KEY` | Server-side MPP secret. Presence toggles MPP on. |
| `MPP_CURRENCY` | Tempo currency address. Use `TEMPO_USDC_CURRENCY` for Tempo USDC. |
| `TEMPO_RPC_URL` | Authenticated Tempo JSON-RPC endpoint. Public `rpc.tempo.xyz` returns 401. |
| `MPP_FEE_PAYER_KEY` | Optional. EVM private key sponsoring gas for client-signed open/top-up txs. |
| `MPP_OPERATOR_KEY` | Optional. Signs server-side close/settle. Must resolve to a different address than `MPP_FEE_PAYER_KEY` (Tempo rejects fee-delegated txs where `sender === feePayer`). |

## Quick start

### 1. Create the router

```typescript
// lib/router.ts
import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'My API',
  description: 'Pay-per-call search.',
  guidance: 'POST /search with { q: string }. Returns top 10 results.',
});
```

`createRouterFromEnv` reads `process.env`, validates everything up front, and throws a single `RouterConfigError` with every problem at once. It auto-enables MPP when `MPP_SECRET_KEY` is set and auto-adds a Solana accept when `SOLANA_PAYEE_ADDRESS` is set. For programmatic configuration (custom networks, multiple payees, etc.), build a `RouterConfig` manually and pass it to `createRouter`.

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
// app/.well-known/x402/route.ts
import { router } from '@/lib/router';
import '@/lib/routes-barrel';  // imports every route module
export const GET = router.wellKnown();

// app/openapi.json/route.ts
export const GET = router.openapi();

// app/llms.txt/route.ts
export const GET = router.llmsTxt();
```

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

**Dynamic (body-driven).**
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

## Handler context

```typescript
interface HandlerContext<TBody, TQuery> {
  body: TBody;
  query: TQuery;
  request: NextRequest;
  wallet: string | null;
  payment: HandlerPaymentContext | null;
  account: unknown;                      // from .apiKey() resolver
  alert: AlertFn;
  setVerifiedWallet: (addr: string) => void;
}
```

`payment` is `null` for unprotected, API-key-only, and SIWX-only requests. For paid requests it carries `protocol`, `status`, `payer`, `amount`, `network`, and best-effort tx / receipt metadata.

## Settlement hooks

```typescript
router.route({ path: 'render' })
  .paid('0.10')
  .body(schema)
  .settlement({
    beforeSettle: async ({ result }) => {
      if (!isUsableResult(result)) {
        throw Object.assign(new Error('Render failed'), { status: 502 });
      }
    },
    afterSettle: async ({ payment, result }) => ledger.record({ tx: payment.transaction, result }),
    onSettledHandlerError: async ({ payment, error }) => compensationQueue.enqueue({ receipt: payment.receipt, error }),
  })
  .handler(async ({ body }) => render(body));
```

`beforeSettle` can still abort the charge for x402 and MPP transaction-payload flows. `onSettledHandlerError` covers already-settled MPP requests whose handler errored; the router cannot generically refund because it does not hold merchant signing keys.

## Plugin

```typescript
import { createRouterFromEnv, type RouterPlugin } from '@agentcash/router';

const myPlugin: RouterPlugin = {
  onRequest(meta) {},
  onPaymentVerified(ctx, payment) {},
  onPaymentSettled(ctx, settlement) {},
  onResponse(ctx, response) {},
  onError(ctx, error) {},
  onAlert(ctx, alert) {},
  onProviderQuota(ctx, event) {},
};

export const router = createRouterFromEnv({
  title: 'My API',
  description: '…',
  guidance: '…',
  plugin: myPlugin,
});
```

All hooks are optional and fire-and-forget; they never delay the response.

## Provider monitoring

For routes wrapping a third-party API with quota:

```typescript
router.route({ path: 'search' })
  .paid('0.01')
  .provider('exa', {
    extractQuota: (result, headers) => ({
      remaining: result.rateLimit?.remaining ?? null,
      limit: result.rateLimit?.limit ?? null,
    }),
    warn: 100,
    critical: 10,
  })
  .body(searchSchema)
  .handler(async ({ body }) => exa.search(body));
```

`extractQuota` runs after each successful response (status < 400). Exceptions are swallowed; the plugin hook `onProviderQuota` fires with level `healthy` / `warn` / `critical`.

For providers that need a separate health-check call, register a `monitor` function. Retrieve registered monitors with `router.monitors()` from a cron entry point.

## Build and test

```bash
pnpm build       # tsup
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm check       # format + lint + typecheck + build + test
```

## License

MIT
