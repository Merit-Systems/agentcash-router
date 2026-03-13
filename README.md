# @agentcash/router

Unified route builder for Next.js App Router APIs with x402 payments, MPP payments, SIWX authentication, and API key auth.

Eliminates ~80-150 lines of boilerplate per route. Routes become 3-6 lines.

## Install

```bash
pnpm add @agentcash/router
```

Peer dependencies:

```bash
pnpm add next zod @x402/core @x402/evm @x402/extensions @coinbase/x402 zod-openapi
# Optional: for MPP support
pnpm add mppx
```

## Environment Setup

The router uses the default facilitator from `@coinbase/x402` for x402 payments, which requires CDP API keys:

```bash
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-key-secret
```

**For Next.js apps with env validation** (T3 stack, `@t3-oss/env-nextjs`): Add these to your env schema — Next.js doesn't expose undeclared env vars to `process.env`.

```typescript
// src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    CDP_API_KEY_ID: z.string(),
    CDP_API_KEY_SECRET: z.string(),
  },
  runtimeEnv: {
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
  },
});
```

Without these keys, x402 routes will fail to initialize (empty 402 responses, no payment header).

## Quick Start

### 1. Create the router (once per service)

```typescript
// lib/routes.ts
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  strictRoutes: true, // recommended
  discovery: {
    title: 'My API',
    version: '1.0.0',
    description: 'Pay-per-call API',
  },
});
```

### 2. Define routes

**Paid route (x402)**

```typescript
// app/api/search/route.ts
import { router } from '@/lib/routes';
import { searchSchema, searchResponseSchema } from '@/lib/schemas';

export const POST = router.route({ path: 'search' })
  .paid('0.01')
  .body(searchSchema)
  .output(searchResponseSchema)
  .description('Search the web')
  .handler(async ({ body }) => search(body));
```

**SIWX-authenticated route**

```typescript
export const GET = router.route({ path: 'inbox/status' })
  .siwx()
  .query(statusQuerySchema)
  .handler(async ({ query, wallet }) => getStatus(query, wallet));
```

**Unprotected route**

```typescript
export const GET = router.route({ path: 'health' })
  .unprotected()
  .handler(async () => ({ status: 'ok' }));
```

### 3. Auto-discovery

Discovery metadata (`title`, `version`, `description`, `guidance`) is configured once in `createRouter({ discovery })`. The discovery handlers are zero-arg:

```typescript
// app/.well-known/x402/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/barrel'; // ensures all routes are imported
export const GET = router.wellKnown();

// app/openapi.json/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/barrel';
export const GET = router.openapi();

// app/llms.txt/route.ts
import { router } from '@/lib/routes';
export const GET = router.llmsTxt();
```

OpenAPI output follows the discovery contract:

- Paid signaling via `responses.402` + `x-payment-info`
- Auth signaling via `security` + `components.securitySchemes`
- Optional top-level metadata via `x-discovery` (`ownershipProofs`)

## API

### `createRouter(config)`

Creates a `ServiceRouter` instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `payeeAddress` | `string` | — | Wallet address to receive payments |
| `baseUrl` | `string` | **required** | Service origin used for discovery/OpenAPI/realm |
| `discovery` | `DiscoveryConfig` | **required** | Title, version, description, guidance for OpenAPI/well-known/llms.txt |
| `network` | `string` | `'eip155:8453'` | Blockchain network |
| `plugin` | `RouterPlugin` | `undefined` | Observability plugin |
| `prices` | `Record<string, string>` | `undefined` | Central pricing map (auto-applied) |
| `siwx.nonceStore` | `NonceStore` | `MemoryNonceStore` | Custom nonce store |
| `mpp` | `{ secretKey, currency, recipient? }` | `undefined` | MPP config |
| `strictRoutes` | `boolean` | `false` | Enforce `route({ path })` and prevent key/path divergence |

### Path-First Routing

Use path-first route definitions to keep runtime, OpenAPI, and discovery aligned:

```typescript
router.route({ path: 'flightaware/airports/id/flights/arrivals', method: 'GET' })
```

If you need a custom internal key (legacy pricing map), you can pass:

```typescript
router.route({ path: 'public/path', key: 'legacy/key' })
```

In `strictRoutes` mode, custom keys are rejected to prevent discovery drift.

### Route Builder

The fluent builder ensures compile-time safety:

- `.paid(price)` / `.paid(fn, { maxPrice })` / `.paid({ field, tiers })` - Payment auth
- `.siwx()` - SIWX wallet auth
- `.apiKey(resolver)` - API key auth (composable with `.paid()`)
- `.unprotected()` - No auth
- `.body(zodSchema)` - Request body validation
- `.query(zodSchema)` - Query parameter validation
- `.output(zodSchema)` - Response schema (for OpenAPI)
- `.description(text)` - Route description (for OpenAPI)
- `.provider(name, config?)` - Provider monitoring (see [Provider Monitoring](#provider-monitoring))
- `.handler(fn)` - Terminal method, returns Next.js handler

### Pricing Modes

**Static** - Fixed price for all requests:
```typescript
router.route('search').paid('0.02')
```

**Dynamic** - Calculate price based on request body:
```typescript
router.route('gen')
  .paid((body) => calculateCost(body.imageSize, body.quality))
  .body(imageGenSchema)
  .handler(async ({ body }) => generate(body));
```

**Dynamic with safety net** - Cap at maxPrice if calculation exceeds, fallback to maxPrice on errors:
```typescript
router.route('compute')
  .paid((body) => calculateExpensiveOperation(body), { maxPrice: '10.00' })
  .body(computeSchema)
  .handler(async ({ body }) => compute(body));
```

**Tiered** - Price based on a specific field value:
```typescript
router.route('upload').paid({
  field: 'tier',
  tiers: {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
  },
}).body(uploadSchema)
```

#### maxPrice Semantics (v0.3.1+)

`maxPrice` is **optional** for dynamic pricing and acts as a safety net:

1. **Capping**: If `calculateCost(body)` returns `"15.00"` but `maxPrice: "10.00"`, the client is charged `$10.00` (capped) and a warning alert fires.

2. **Fallback**: If `calculateCost(body)` throws an error and `maxPrice` is set, the route falls back to `maxPrice` (degraded mode) and an alert fires. Without `maxPrice`, the route returns 500.

3. **Trust mode**: No `maxPrice` means full trust in your pricing function (no cap, no fallback).

**Best practices:**
- ✅ Always set `maxPrice` for production routes (safety net)
- ✅ Use `maxPrice` for routes with external dependencies (pricing APIs)
- ✅ Monitor alerts for capping events (indicates pricing bug)
- ⚠️ Skip `maxPrice` only for well-tested, unbounded pricing (e.g., per-GB storage)

**Example with safety net:**
```typescript
router.route('ai-gen')
  .paid(async (body) => {
    // External pricing API (can fail)
    const res = await fetch('https://pricing.example.com/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.json().price;
  }, { maxPrice: '5.00' })  // Fallback if API is down
  .body(genSchema)
  .handler(async ({ body }) => generate(body));
```

### Dual Protocol (x402 + MPP)

```typescript
router.route('search')
  .paid('0.01', { protocols: ['x402', 'mpp'] })
  .body(schema)
  .handler(fn);
```

### Handler Context

```typescript
interface HandlerContext<TBody, TQuery> {
  body: TBody;              // Parsed + validated
  query: TQuery;            // Parsed + validated
  request: NextRequest;     // Raw request
  wallet: string | null;    // Verified wallet address
  account: unknown;         // From .apiKey() resolver
  alert: AlertFn;           // Fire observability alerts
  setVerifiedWallet: (addr: string) => void;
}
```

### RouterPlugin

Pluggable observability. All hooks are optional and fire-and-forget.

```typescript
import { createRouter, type RouterPlugin } from '@agentcash/router';

const myPlugin: RouterPlugin = {
  onRequest(meta) { /* ... */ },
  onPaymentVerified(ctx, payment) { /* ... */ },
  onPaymentSettled(ctx, settlement) { /* ... */ },
  onResponse(ctx, response) { /* ... */ },
  onError(ctx, error) { /* ... */ },
  onAlert(ctx, alert) { /* ... */ },
  onProviderQuota(ctx, event) { /* ... */ },
};

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: myPlugin,
});
```

Built-in `consolePlugin()` logs lifecycle events:

```typescript
import { createRouter, consolePlugin } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: consolePlugin(),
});
```

### Central Pricing Map

For services with many static-priced routes:

```typescript
const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  prices: {
    'search': '0.02',
    'lookup': '0.05',
  },
});

// Price auto-applied, no .paid() needed
export const POST = router.route('search')
  .body(schema)
  .handler(fn);
```

### Provider Monitoring

Routes that wrap third-party APIs can declare monitoring behavior per-provider. This surfaces quota/balance information through the plugin system and registers cron-checkable monitors.

#### Why

Upstream providers report remaining quota in different ways:

| Pattern | Example | How detected |
|---------|---------|-------------|
| Balance in response headers | `X-RateLimit-Remaining: 482` | `extractQuota` reads headers |
| Balance in response body | `{ rateLimit: { remaining: 50 } }` | `extractQuota` reads result |
| Separate health-check endpoint | Apollo `/credits` endpoint | `monitor` function (cron) |
| Overages auto-charged at same rate | Exa, Firecrawl | `overage: 'same-rate'` |
| Overages at increased rate | Some SaaS APIs | `overage: 'increased-rate'` |
| No overages, immediate stoppage | Whitepages | `overage: 'hard-stop'` |

The `.provider()` method handles all six patterns through a single interface.

#### Basic usage

```typescript
export const POST = router.route('search')
  .paid('0.01')
  .provider('exa', {
    extractQuota: (result, headers) => ({
      remaining: (result as any).rateLimit?.remaining ?? null,
      limit: (result as any).rateLimit?.limit ?? null,
    }),
    warn: 100,
    critical: 10,
  })
  .body(searchSchema)
  .handler(async ({ body }) => exaClient.search(body));
```

After every successful handler response, `extractQuota` runs with the raw handler result and the response headers. The router computes a level (`healthy`, `warn`, `critical`) based on thresholds and fires `onProviderQuota` on the plugin.

#### ProviderConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `extractQuota` | `(result, headers) => QuotaInfo \| null` | — | Inline quota extraction after each request |
| `monitor` | `() => Promise<QuotaInfo \| null>` | — | Standalone health check (for cron) |
| `overage` | `'same-rate' \| 'increased-rate' \| 'hard-stop'` | `'same-rate'` | What happens when quota hits zero |
| `warn` | `number` | — | Fire `warn` level when remaining <= this |
| `critical` | `number` | — | Fire `critical` level when remaining <= this |

#### QuotaInfo

```typescript
interface QuotaInfo {
  remaining: number | null;  // Credits/calls remaining
  limit: number | null;      // Total quota (null if unknown)
  spend?: number;             // Credits consumed this request
}
```

#### Threshold logic

| Condition | Level |
|-----------|-------|
| `remaining === null` | `healthy` (no data to compare) |
| `remaining <= critical` | `critical` |
| `remaining <= warn` | `warn` |
| Otherwise | `healthy` |

#### Plugin hook

```typescript
interface ProviderQuotaEvent {
  provider: string;       // Provider name from .provider()
  route: string;          // Route key
  remaining: number | null;
  limit: number | null;
  spend?: number;
  level: 'healthy' | 'warn' | 'critical';
  overage: 'same-rate' | 'increased-rate' | 'hard-stop';
  message: string;        // Human-readable summary
}
```

Handle in your plugin:

```typescript
const myPlugin: RouterPlugin = {
  onProviderQuota(ctx, event) {
    if (event.level === 'critical') {
      discord.alert(`${event.provider}: ${event.remaining} remaining`);
    }
    clickhouse.insert('provider_quota', event);
  },
};
```

#### Cron monitors

For providers that require a separate API call to check balance (not available inline in response), register a `monitor` function:

```typescript
export const POST = router.route('people/search')
  .paid('0.05')
  .provider('apollo', {
    monitor: async () => {
      const res = await fetch('https://api.apollo.io/v1/credits', {
        headers: { 'X-Api-Key': process.env.APOLLO_KEY! },
      });
      const data = await res.json();
      return { remaining: data.credits, limit: null };
    },
    overage: 'hard-stop',
    warn: 500,
    critical: 50,
  })
  .body(searchSchema)
  .handler(fn);
```

Retrieve all registered monitors via `router.monitors()`:

```typescript
// cron.ts — run every 5 minutes
import { router } from '@/lib/routes';
import '@/lib/routes/barrel';

for (const entry of router.monitors()) {
  const quota = await entry.monitor();
  if (!quota) continue;

  const level = quota.remaining !== null && quota.remaining <= (entry.critical ?? 0)
    ? 'critical'
    : quota.remaining !== null && quota.remaining <= (entry.warn ?? 0)
      ? 'warn'
      : 'healthy';

  if (level !== 'healthy') {
    alert(`${entry.provider} (${entry.route}): ${quota.remaining} remaining [${level}]`);
  }
}
```

`monitors()` returns:

```typescript
interface MonitorEntry {
  provider: string;
  route: string;
  monitor: () => Promise<QuotaInfo | null>;
  overage: OveragePolicy;
  warn?: number;
  critical?: number;
}
```

#### Provider name only

If you just want to tag a route with its provider for logging/tracing, pass only the name:

```typescript
router.route('health')
  .unprotected()
  .provider('internal')
  .handler(async () => ({ status: 'ok' }));
```

#### Safety guarantees

- `extractQuota` runs fire-and-forget — exceptions are caught and swallowed
- `extractQuota` only runs when `response.status < 400` (no quota extraction on errors)
- The plugin hook is non-blocking — it never delays the response to the caller
- Missing thresholds are fine — without `warn`/`critical`, level is always `healthy`

## License

MIT
