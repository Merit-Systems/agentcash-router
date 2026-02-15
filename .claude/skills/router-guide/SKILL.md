---
name: router-guide
description: Use when creating, modifying, or debugging routes with @agentcash/router. Covers route creation, auth modes, pricing, provider monitoring, discovery, plugins, and troubleshooting. Trigger phrases include "add a route", "create an endpoint", "set up discovery", "add provider monitoring", "configure the router".
---

# @agentcash/router Guide

You are helping a developer build API routes using `@agentcash/router`. This package is a fluent route builder for Next.js App Router that handles x402 payments, MPP payments, SIWX authentication, API key auth, and provider monitoring.

## Philosophy and Design Constraints

These are intentional decisions. Do not change them without explicit user approval.

### Why this exists

Every paid API route in a Merit Systems service shared the same ~80-150 lines of boilerplate: x402 server init, payment verification, body parsing, settlement gating, error handling, observability hooks. Five services meant five copies that drifted. This router eliminates that by encoding the lifecycle into a fluent builder that compiles to a single Next.js handler function.

### Core design principles

1. **Fluent builder, not config object.** Progressive discoverability via IDE autocomplete. The chain reads like a sentence: `route('search').paid('0.01').body(schema).handler(fn)`. Config objects hide available options; fluent chains surface them.

2. **Use `x402ResourceServer` primitives directly, not `withX402`.** The `withX402` wrapper from `@coinbase/x402` is a convenience that owns the full request lifecycle. We need to interleave body parsing, Zod validation, plugin hooks, and settlement gating at specific points in that lifecycle, so we call the lower-level primitives (`buildPaymentRequirementsFromOptions`, `verifyPayment`, `settlePayment`) directly.

3. **Auth modes are mutually exclusive per route, except `apiKey` + `paid`.** A route is either paid, SIWX-authenticated, API-key-gated, or unprotected. The one exception: `.apiKey()` can compose with `.paid()` because some routes need both identity (API key) and payment (x402/MPP). This is enforced at the type level.

4. **Body is only buffered when `.body()` is chained.** If a route doesn't declare a body schema, the request stream is untouched. This matters for routes that proxy multipart uploads or streams. For dynamic pricing, the body IS parsed before the 402 challenge (via `request.clone()`) so the pricing function can calculate an accurate price.

5. **Settlement is gated on `response.status < 400`.** If the handler throws or returns an error response, no settlement occurs. The payer's funds are not captured. This is a fundamental safety guarantee.

6. **The plugin interface is the observability boundary.** All Merit-specific telemetry (ClickHouse, Discord alerts, usage tracking) lives in a private `RouterPlugin` implementation. The router itself is fully open-source with zero Merit-specific code. The plugin hooks are fire-and-forget — they never delay the response.

7. **Self-registering routes + validated barrel (Approach B).** Routes self-register via `.handler()` at import time. A barrel file imports all route modules. Discovery endpoints (`.wellKnown()`, `.openapi()`) validate that the barrel is complete by comparing registered routes against the `prices` map. For routes in separate handler files (e.g., Next.js `route.ts` files), use **discovery stubs** — lightweight registrations that provide metadata for discovery without the real handler. Guard stubs with `registry.has()` to avoid unnecessary overwrites.

8. **Both x402 and MPP ship from day one.** Dual-protocol support is not an afterthought. Routes declare `protocols: ['x402', 'mpp']` and the orchestration layer routes to the correct handler based on the request header. MPP uses low-level `mpay` primitives (`Challenge`, `Credential`, `tempo.charge`) — not the high-level `Mpay.create()` wrapper — because the router owns orchestration.

9. **`zod-openapi` for OpenAPI 3.1.** Zod schemas are the single source of truth for request/response types. OpenAPI docs are auto-generated from them. No manual spec maintenance.

10. **Fakes over mocks in tests.** The test suite uses `FakeX402Server` (a behavioral fake that accepts known payer/payee/amount tuples) instead of vi.mock stubs. This tests real verification logic, not mock wiring.

### Version Stability

The public API is **not stable**. Downstream consumers should pin exact versions (`"@agentcash/router": "0.2.0"`, not `"^0.2.0"`). Breaking changes will happen as we build out multi-protocol support and discover patterns across services. Semver will be respected once we hit 1.0.

### Non-goals (deliberately rejected)

- **No middleware chain.** Express-style middleware (`use()`) was considered and rejected. The builder's fixed lifecycle (auth → parse → validate → price → verify → handler → settle) covers all routes. Custom logic goes in the handler or plugin.
- **No per-request config overrides.** The route is fully configured at definition time. Runtime behavior changes go through the handler function, not builder reconfiguration.
- **No automatic retry on settlement failure.** Settlement failures are logged as critical alerts. Retry logic belongs in the plugin implementation, not the router core.

## Architecture Overview

```
createRouter(config) → ServiceRouter
  ├── .route(key) → RouteBuilder (fluent chain)
  │     ├── Auth:  .paid() | .siwx() | .apiKey() | .unprotected()
  │     ├── Schema: .body(zod) | .query(zod) | .output(zod)
  │     ├── Meta:  .description() | .path() | .provider()
  │     └── Terminal: .handler(fn) → Next.js handler
  ├── .wellKnown() → /.well-known/x402 handler
  ├── .openapi()   → /openapi.json handler
  └── .monitors()  → MonitorEntry[] (for cron)
```

### Request lifecycle (orchestrate.ts)

```
Request in
  → await x402 server init
  → plugin.onRequest() → PluginContext
  → if unprotected: skip to handler
  → if apiKey route: verify API key → 401 if invalid
  → detectProtocol(request) from headers
  → if no payment header + dynamic pricing + body schema:
      early body parse via request.clone() for accurate 402 price
  → if SIWX: challenge or verify → handleAuth
  → if no auth header: build 402 challenge
      (x402: PAYMENT-REQUIRED header, MPP: WWW-Authenticate header)
  → bufferBody + validateBody (only if .body() chained)
  → resolvePrice (static / dynamic / tiered)
  → protocol verify (x402 or MPP)
  → plugin.onPaymentVerified()
  → handler(ctx) → result
  → if status < 400: settle payment (x402) or receipt (MPP)
  → if provider configured: fireProviderQuota()
  → plugin.onResponse()
Response out
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | `createRouter()`, `ServiceRouter`, re-exports |
| `src/builder.ts` | `RouteBuilder` fluent API with type-level state tracking |
| `src/orchestrate.ts` | Core request lifecycle, `createRequestHandler()` |
| `src/types.ts` | `HttpError`, `HandlerContext`, pricing/provider/auth types |
| `src/plugin.ts` | `RouterPlugin` interface, `consolePlugin()`, `firePluginHook()` |
| `src/pricing.ts` | `resolvePrice()`, `resolveMaxPrice()` |
| `src/handler.ts` | `safeCallHandler()` error boundary |
| `src/body.ts` | `bufferBody()`, `validateBody()` |
| `src/registry.ts` | `RouteRegistry` with barrel validation |
| `src/protocols/detect.ts` | Header-based protocol detection |
| `src/protocols/x402.ts` | x402 challenge/verify/settle wrappers |
| `src/protocols/mpp.ts` | MPP challenge/verify/receipt wrappers (uses mpay low-level primitives) |
| `src/server.ts` | x402 server initialization with retry |
| `src/auth/siwx.ts` | SIWX verification |
| `src/auth/api-key.ts` | API key verification |
| `src/auth/nonce.ts` | `NonceStore` interface + `MemoryNonceStore` |
| `src/discovery/well-known.ts` | `.well-known/x402` generation |
| `src/discovery/openapi.ts` | OpenAPI 3.1 spec generation |

## Environment Setup

**CRITICAL:** The router uses the default facilitator from `@coinbase/x402`, which requires CDP API keys at runtime:

```bash
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-key-secret
```

**For Next.js apps with env validation (T3 stack, `@t3-oss/env-nextjs`):** These must be declared in your env schema. Next.js does not expose undeclared env vars to `process.env`.

Without these keys, x402 server initialization fails:
- Error: `"Failed to fetch supported kinds from facilitator: TypeError: fetch failed"`
- Or: `"Facilitator getSupported failed (401): Unauthorized"`
- Symptom: All paid routes return empty 402 responses (no `PAYMENT-REQUIRED` header)

**Example env schema (T3):**

```typescript
// src/env.js
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

**Why this matters:** The default facilitator reads `process.env.CDP_API_KEY_ID` and `process.env.CDP_API_KEY_SECRET` when creating auth headers for the CDP facilitator API. If they're not in `process.env`, authentication fails silently — the facilitator sends requests without `Authorization` headers, and CDP returns 401.

### MPP environment

For MPP (Micropayment Protocol via Tempo blockchain), you need:

```bash
MPP_SECRET_KEY=your-hmac-secret       # HMAC key for challenge binding
TEMPO_RPC_URL=https://user:pass@rpc.mainnet.tempo.xyz  # Authenticated Tempo RPC
```

**Tempo RPC requires authentication.** The default `rpc.tempo.xyz` returns 401. Get credentials from the Tempo team. The `rpcUrl` can be set in config or via `TEMPO_RPC_URL` env var (config takes precedence).

**Peer dependencies for MPP:** `mpay` is an optional peer dep. When installed, it brings `viem` as a transitive dependency. Both are required for MPP support.

## Creating Routes

### Step 1: Router setup (once per service)

```typescript
// lib/routes.ts
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  // Optional:
  network: 'eip155:8453',            // default
  protocols: ['x402', 'mpp'],        // protocols for auto-priced routes (default: ['x402'])
  plugin: myPlugin,                   // observability
  prices: { 'search': '0.02' },      // central pricing map
  mpp: {                              // MPP support (requires mpay peer dep)
    secretKey: process.env.MPP_SECRET_KEY!,
    currency: '0x20c0000000000000000000000000000000000000', // PathUSD on Tempo
    recipient: process.env.X402_PAYEE_ADDRESS!,
    rpcUrl: process.env.TEMPO_RPC_URL,  // falls back to TEMPO_RPC_URL env var
  },
  siwx: { nonceStore },              // custom nonce store
});
```

**Router-level `protocols`:** Sets default protocols for routes using the `prices` map (auto-priced routes). Routes using `.paid()` directly can override with `{ protocols: [...] }`.

### Step 2: Define route files

Each route file exports a Next.js handler (`GET`, `POST`, etc.):

```typescript
// app/api/search/route.ts
import { router } from '@/lib/routes';
import { searchSchema, searchResponseSchema } from '@/lib/schemas';

export const POST = router.route('search')
  .paid('0.01')
  .body(searchSchema)
  .output(searchResponseSchema)
  .description('Search the web')
  .handler(async ({ body }) => searchService(body));
```

### Step 3: Barrel import

```typescript
// lib/routes/barrel.ts
import '@/app/api/search/route';
import '@/app/api/lookup/route';
// ... all route files
```

The barrel ensures all routes are registered before discovery endpoints generate their output.

## Auth Modes

### Paid (x402) — static price
```typescript
router.route('search').paid('0.01').body(schema).handler(fn);
```

### Paid (dynamic pricing)
```typescript
router.route('gen')
  .paid((body) => calculateCost(body), { maxPrice: '5.00' })
  .body(schema)
  .handler(fn);
```
**How it works:** When a request arrives without a payment header, the router clones the request (`request.clone()`), parses the body early, and calls the pricing function to calculate an accurate price for the 402 challenge. This means clients see the real price, not a ceiling.

`maxPrice` is **optional** and acts as a safety net:
- **Cap:** If the pricing function returns a value above `maxPrice`, the price is capped and a warning is fired via the plugin.
- **Fallback:** If the pricing function throws, `maxPrice` is used as a degraded-mode fallback. Without `maxPrice`, the route returns 500.
- If omitted and the pricing function succeeds, the exact calculated price is used.

### Paid (tiered) — requires body
```typescript
router.route('upload').paid({
  field: 'tier',
  tiers: {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
  },
}).body(schema).handler(fn);
```
The tier value comes from `body[field]`. The 402 challenge uses the highest tier price.

### Dual protocol (x402 + MPP)
```typescript
router.route('search')
  .paid('0.01', { protocols: ['x402', 'mpp'] })
  .body(schema).handler(fn);
```

### SIWX (wallet auth, no payment)
```typescript
router.route('inbox/status')
  .siwx()
  .query(querySchema)
  .handler(async ({ query, wallet }) => getStatus(query, wallet));
```

### API key (composable with paid)
```typescript
router.route('admin/lookup')
  .apiKey((key) => key === 'valid' ? { id: 'acct-1' } : null)
  .paid('0.05')
  .body(schema)
  .handler(async ({ body, account }) => lookup(body, account));
```
API key is checked first (401 on failure), then payment flow runs.

### Unprotected
```typescript
router.route('health').unprotected().handler(async () => ({ status: 'ok' }));
```

## Handler Context

Every handler receives:

```typescript
interface HandlerContext<TBody, TQuery> {
  body: TBody;              // Parsed + validated (undefined if no .body())
  query: TQuery;            // Parsed + validated (undefined if no .query())
  request: NextRequest;     // Raw request
  requestId: string;        // Unique per-request UUID (for logging/tracing)
  route: string;            // Route key (e.g. 'search', 'lookup/org')
  wallet: string | null;    // Verified wallet (from payment or SIWX)
  account: unknown;         // From .apiKey() resolver
  alert: AlertFn;           // Fire observability alerts
  setVerifiedWallet: (addr: string) => void;
}
```

## Provider Monitoring

Routes that wrap third-party APIs can declare monitoring behavior per-provider. This surfaces quota/balance information through the plugin system.

### The six provider patterns

| Pattern | How handled |
|---------|-------------|
| Balance in response headers | `extractQuota` reads `headers` |
| Balance in response body | `extractQuota` reads `result` |
| Separate health-check endpoint | `monitor` function (for cron) |
| Overages at same rate | `overage: 'same-rate'` |
| Overages at increased rate | `overage: 'increased-rate'` |
| No overages, hard stop | `overage: 'hard-stop'` |

### Usage

```typescript
export const POST = router.route('exa/search')
  .paid('0.01')
  .provider('exa', {
    extractQuota: (result, headers) => ({
      remaining: (result as any).rateLimit?.remaining ?? null,
      limit: (result as any).rateLimit?.limit ?? null,
    }),
    monitor: async () => {
      const res = await fetch('https://api.exa.ai/usage');
      const data = await res.json();
      return { remaining: data.credits, limit: data.limit };
    },
    overage: 'same-rate',
    warn: 100,
    critical: 10,
  })
  .body(searchSchema)
  .handler(async ({ body }) => exaClient.search(body));
```

### ProviderConfig fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `extractQuota` | `(result, headers) => QuotaInfo \| null` | — | Inline extraction after each success |
| `monitor` | `() => Promise<QuotaInfo \| null>` | — | Standalone check for cron |
| `overage` | `'same-rate' \| 'increased-rate' \| 'hard-stop'` | `'same-rate'` | What happens at zero |
| `warn` | `number` | — | Warn level threshold |
| `critical` | `number` | — | Critical level threshold |

### Threshold logic

- `remaining === null` → `healthy` (no data)
- `remaining <= critical` → `critical`
- `remaining <= warn` → `warn`
- Otherwise → `healthy`

### Cron monitors

```typescript
for (const entry of router.monitors()) {
  const quota = await entry.monitor();
  // entry: { provider, route, monitor, overage, warn, critical }
}
```

### Safety guarantees

- `extractQuota` is fire-and-forget — exceptions never affect the response
- Only runs when `response.status < 400`
- Plugin hook (`onProviderQuota`) is non-blocking

## Discovery Setup

```typescript
// app/.well-known/x402/route.ts
import '@/lib/routes/barrel';  // barrel import FIRST to register all routes
import { router } from '@/lib/routes';
export const GET = router.wellKnown();

// app/openapi.json/route.ts
import '@/lib/routes/barrel';
import { router } from '@/lib/routes';
export const GET = router.openapi({ title: 'My API', version: '1.0.0' });
```

**Barrel import must come first.** Without it, Next.js lazy-loads route modules, so discovery endpoints hit before routes register → `route 'X' in prices map but not registered` error.

**`.well-known/x402` output** includes `mppResources` alongside `resources` when MPP routes exist:
```json
{ "version": 1, "resources": ["..."], "mppResources": ["..."] }
```

**OpenAPI spec** includes `x-payment-info` with `price` and `protocols` per operation.

## Plugin (Observability)

```typescript
const myPlugin: RouterPlugin = {
  onRequest(meta) { /* return PluginContext */ },
  onPaymentVerified(ctx, payment) { /* log payment */ },
  onPaymentSettled(ctx, settlement) { /* log tx */ },
  onResponse(ctx, response) { /* log response */ },
  onError(ctx, error) { /* alert on errors */ },
  onAlert(ctx, alert) { /* handle custom alerts */ },
  onProviderQuota(ctx, event) { /* handle quota events */ },
};
```

All hooks are optional. All are fire-and-forget. Use `consolePlugin()` for dev logging.

## Builder Compile-Time Safety

The type system (generic parameters `HasAuth`, `NeedsBody`, `HasBody`) prevents invalid chains:

- `.handler()` requires auth to be set first
- Dynamic/tiered pricing requires `.body()` before `.handler()`
- `.siwx()` is mutually exclusive with `.paid()`
- `.apiKey()` CAN compose with `.paid()`

## MPP Internals (Critical Pitfalls)

The router uses mpay's **low-level primitives**, not the high-level `Mpay.create()` API. This matters because mpay's internals have subtle conventions:

1. **NextRequest vs Request.** `Credential.fromRequest()` breaks with Next.js `NextRequest` due to subtle header handling differences. The router converts via `toStandardRequest()` — creating a new standard `Request` with the same URL, method, headers, and body.

2. **`Challenge.fromIntent()` takes payment data, not an HTTP Request.** The `request` field in `fromIntent()` is the payment request object (`{ amount, currency, recipient, decimals }`), NOT the HTTP Request. Passing the wrong object causes silent challenge generation failures.

3. **`tempo.charge().verify()` returns a receipt, not `{ valid, payer }`.** On success it returns `{ method, status, reference, timestamp }`. On failure it throws. Check `receipt.status === 'success'`, not `receipt.valid`.

4. **`getClient` must be synchronous.** mpay's `Client.getResolver()` checks `if (getClient) return getClient` — it does NOT await. An async `getClient` will silently fall through to the default RPC URL.

5. **Tempo RPC requires authentication.** The default `rpc.tempo.xyz` returns 401. Always provide `rpcUrl` or set `TEMPO_RPC_URL` env var with authenticated credentials.

6. **viem is loaded eagerly in `ensureMpay()`.** Since `getClient` must be synchronous, viem's `createClient` and `http` are loaded once when mpay initializes, not per-call. viem is a transitive dep of mpay and is always available when mpay is installed.

## Registration-Time Validation

These throw immediately when the route is defined (not at request time):

- Empty tier key in tiered pricing
- `maxPrice` that isn't a positive decimal

**Duplicate route keys** do NOT throw — the registry silently overwrites with a dev-only `console.warn`. This is intentional: Next.js `next build` loads modules non-deterministically, so discovery stubs and real handlers may register the same key in either order. Last writer wins. Prior art: ElysiaJS uses the identical pattern.

## Central Pricing Map

```typescript
const router = createRouter({
  payeeAddress: '...',
  protocols: ['x402', 'mpp'],                    // default protocols for all auto-priced routes
  prices: { 'search': '0.02', 'lookup': '0.05' },
  mpp: { secretKey, currency, recipient, rpcUrl },
});

// .paid() is auto-applied with router-level protocols:
export const POST = router.route('search').body(schema).handler(fn);
```

Routes using `prices` inherit the router-level `protocols` config. Routes using `.paid()` directly can override per-route with `{ protocols: [...] }`.

Barrel validation catches mismatches: keys in `prices` but not registered → error.

## Common Patterns

### Return an error from handler
```typescript
.handler(async ({ body }) => {
  if (!valid(body)) throw new HttpError('Invalid input', 400);
  return result;
});
```

### Return a raw Response (streaming)
```typescript
.handler(async ({ body }) => {
  return new Response(streamData, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
});
```

### Fire a custom alert
```typescript
.handler(async ({ body, alert }) => {
  const result = await callProvider(body);
  if (result.slow) alert('warn', 'Slow response', { latency: result.latency });
  return result;
});
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `route 'X' registered twice` warning | Discovery stub + real handler both register same key | Expected during `next build` — last writer wins. Use `registry.has()` guards on stubs to suppress. |
| `x402 server not initialized` | Missing peer deps | Install `@x402/core @x402/evm @x402/extensions @coinbase/x402` |
| 402 on every request | No payment header | Client must send `PAYMENT-SIGNATURE` (x402) or `Authorization: Payment` (MPP) |
| Body undefined in handler | No `.body()` chained | Add `.body(schema)` to the chain |
| Route not in discovery docs | Missing barrel import | Import the route file in your barrel |
| Settlement not happening | Handler returned status >= 400 | Settlement is gated on success responses |
| MPP 401 `unauthorized: authentication required` | Using default unauthenticated Tempo RPC | Set `TEMPO_RPC_URL` env var or `mpp.rpcUrl` config with authenticated URL |
| MPP `Credential.fromRequest()` returns undefined | NextRequest header handling incompatibility | Router handles this via `toStandardRequest()` — if you see this, the router dist is stale |
| MPP verify returns `status: 'success'` but route returns 402 | Code checking `.valid` instead of `.status` | Verify returns a receipt `{ status, reference }`, not `{ valid, payer }` |
| MPP using wrong RPC URL after rebuild | Next.js webpack cache or stale pnpm link | Delete `.next/`, run `pnpm install` in the app to pick up new router dist |
| `route 'X' in prices map but not registered` | Discovery endpoint hit before route module loaded | Add barrel import to discovery route files |
| `mpay package is required` | mpay not installed | `pnpm add mpay` — it's an optional peer dep |

## Maintaining This Skill

This skill file is the canonical reference for `@agentcash/router`. It ships with the repo at `.claude/skills/router-guide/SKILL.md` so that any agent working with the router has accurate, up-to-date guidance.

**When you modify the router, update this skill.** Specifically:

- **New interfaces or types** — Add them to the relevant section (Handler Context, Plugin, Provider Monitoring, etc.)
- **New builder methods** — Document in the Auth Modes or Common Patterns sections
- **New plugin hooks** — Add to the Plugin section
- **Changed behavior** — Update the Request Lifecycle diagram and any affected sections
- **New troubleshooting entries** — Add to the Troubleshooting table
- **New design constraints or non-goals** — Add to the Philosophy section

The goal is that any future agent can read this single file and implement correctly without needing to reverse-engineer the source. Keep it accurate, keep it concise.

## Porting Services to the Router

When porting an existing service to `@agentcash/router`, the service's route patterns may not cleanly map to the router's abstractions. **If you encounter a pattern that the router doesn't support, do not work around it silently.** Instead:

1. **Inform the user** — explain what the service does, what the router expects, and where the mismatch is.
2. **Suggest a router PR** — if the gap is a reasonable feature (not a one-off hack), propose adding it to the router. Describe the change, which files it touches, and why it's general-purpose.
3. **Let the user decide** — they may prefer a workaround, a router change, or restructuring the service.

Common conformance gaps to watch for:
- Handler that needs raw request body (not JSON) — router buffers as JSON when `.body()` is chained. Consider if the route should skip `.body()` and parse from `ctx.request` directly.
- Multiple pricing strategies on one route — router supports static, dynamic, or tiered, but only one per route.
- Auth mode that doesn't fit the 4 modes — router enforces paid/siwx/apiKey/unprotected. Composite auth beyond apiKey+paid is not supported.
- Custom response headers set by middleware — router owns the response lifecycle. Headers go in the handler return or via the plugin.
