<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://agentcash.dev/logo-dark-striped.svg">
    <img alt="AgentCash" src="https://agentcash.dev/logo-light-striped.svg" width="360">
  </picture>
</p>

<h1 align="center">@agentcash/router</h1>

<p align="center">
  <strong>The fastest way to ship an API on x402 and MPP.</strong><br/>
  x402 and MPP payments, compatible discovery, and minimal boilerplate. With @agentcash/router, agents on <a href="https://agentcash.dev">AgentCash</a> and across the agentic commerce ecosystem can call your endpoints from day one.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agentcash/router"><img alt="npm" src="https://img.shields.io/npm/v/@agentcash/router.svg?color=111&label=npm"></a>
  <a href="https://agentcash.dev/docs"><img alt="docs" src="https://img.shields.io/badge/docs-agentcash.dev-111"></a>
  <a href="#install"><img alt="next.js" src="https://img.shields.io/badge/Next.js-App%20Router-111"></a>
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Ftree%2Fmain%2Fexamples%2Fvercel-deploy&project-name=agentcash-fortune-demo&repository-name=agentcash-fortune-demo&demo-title=AgentCash%20Router%20Fortune%20Demo&demo-description=Pay-per-call%20fortune%20API%20on%20x402%20and%20MPP&demo-url=https%3A%2F%2Fagentcash.dev&env=EVM_PAYEE_ADDRESS%2CCDP_API_KEY_ID%2CCDP_API_KEY_SECRET&envDescription=Wallet%20that%20receives%20payments%20%2B%20Coinbase%20Developer%20Platform%20API%20keys%20for%20the%20default%20x402%20facilitator.%20Create%20keys%20in%20the%20generous%20CDP%20free%20tier%3A%20https%3A%2F%2Fportal.cdp.coinbase.com%2Fprojects%2Fapi-keys&envLink=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Fblob%2Fmain%2Fexamples%2Fvercel-deploy%2FREADME.md%23environment-variables">
    <img alt="Deploy with Vercel" src="https://vercel.com/button">
  </a>
</p>

---

## Install

```bash
pnpm add @agentcash/router
pnpm add zod  # peer dependency
```

The core is framework-agnostic (Web-standard `Request`/`Response`) — Next.js is one hosting option, not a dependency. See [Hosting](#hosting).

## Environment

The recommended entry point reads its config from `process.env`. A copy-paste `.env.example` lives at the repo root.

### x402

| Var | Required | Purpose |
|-----|----------|---------|
| `EVM_PAYEE_ADDRESS` | yes | EVM address that receives x402 and MPP payments (`0x…`, 20 bytes). Canonicalized to lowercase. The zero address is rejected. |
| `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | yes (EVM) | Coinbase Developer Platform credentials for the default EVM facilitator. Create API keys in the generous CDP free tier at https://portal.cdp.coinbase.com/projects/api-keys. T3 / `@t3-oss/env-nextjs` users must declare these in their env schema. |

> **Router construction phones the facilitator.** Creating the router kicks off a background fetch of the facilitator's supported payment kinds — including during `next build`. With missing or placeholder CDP keys you'll see `[x402] facilitator /supported failed, using hardcoded baseline: …` in build/dev logs. That's a graceful fallback, not a fatal error; paid routes still serve correct 402 challenges.

### Solana

| Var | Required | Purpose |
|-----|----------|---------|
| `SOLANA_PAYEE_ADDRESS` | no | When set, adds a Solana `exact` accept so the router takes Solana payments. **`.upTo()` is Base-only and `.session()` is MPP-only**. Solana clients can only pay static-priced `.paid()` routes. |
| `SOLANA_FACILITATOR_URL` | no | Override the Solana x402 facilitator. Defaults to `DEFAULT_SOLANA_FACILITATOR_URL`. |

### MPP (auto-enabled when `MPP_SECRET_KEY` is set)

| Var | Required | Purpose |
|-----|----------|---------|
| `MPP_SECRET_KEY` | when MPP is enabled | Server-side MPP secret. Presence toggles MPP on. |
| `MPP_CURRENCY` | when MPP is enabled | Tempo currency address. Use `TEMPO_USDC_ADDRESS` for Tempo USDC. |
| `TEMPO_RPC_URL` | no | Tempo JSON-RPC endpoint for MPP on-chain verification. Defaults to the public `DEFAULT_TEMPO_RPC_URL` (`https://rpc.tempo.xyz`). Override only if you have a dedicated endpoint. |
| `MPP_OPERATOR_KEY` | no | Signs server-side close/settle. When set, MPP session mode is enabled automatically (required for `.session()`: both streaming and request-mode per-unit billing). Address must equal the payee. |
| `MPP_FEE_PAYER_KEY` | no | Sponsors client gas for channel open/topUp. Must resolve to a different address than `MPP_OPERATOR_KEY` (Tempo rejects fee-delegated txs where `sender === feePayer`). |

> **MPP session mode needs the payee's private key.** Unlike x402 (address only), `.session()` routes settle server-side, so `MPP_OPERATOR_KEY` must be the private key *of* `EVM_PAYEE_ADDRESS`. For local development, mint a throwaway keypair where the two line up:
>
> ```bash
> npm i -D viem  # or pnpm add -D viem
> node -e "const {generatePrivateKey, privateKeyToAccount} = require('viem/accounts');
>   const pk = generatePrivateKey();
>   console.log('EVM_PAYEE_ADDRESS=' + privateKeyToAccount(pk).address);
>   console.log('MPP_OPERATOR_KEY=' + pk);"
> ```

### Other

| Var | Required | Purpose |
|-----|----------|---------|
| `BASE_URL` | yes outside Vercel | Origin URL (`https://api.example.com`). Load-bearing: used as the 402 realm, OpenAPI server URL, and MPP memo prefix. Must match the public domain. On Vercel, `createRouterFromEnv` auto-derives this from `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`. |
| `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` | no | Vercel system env vars used as fallbacks when `BASE_URL` is unset. Do not set these manually; Vercel provides them during builds and runtime. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no | Upstash / Vercel KV. Backs SIWX nonce, SIWX entitlement, and MPP replay. In-memory fallback is unsafe in serverless production. Providing a Kv Store is highly recommended. |

## Quick start

### 1. Create the router

There are two ways to initialize. Pick one.

**Option A: `createRouterFromEnv` (recommended).** Reads `process.env`, validates every value up front, and throws a single `RouterConfigError` with every problem at once. Auto-enables MPP when `MPP_SECRET_KEY` is set, auto-adds a Solana accept when `SOLANA_PAYEE_ADDRESS` is set, auto-enables MPP session mode when `MPP_OPERATOR_KEY` is set.

```typescript
// lib/router.ts
import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'My API',
  description: 'Pay-per-call search.',
  guidance: 'POST /search with { q: string }. Returns top 10 results.',
});
```

**Option B: build a `RouterConfig` and pass it to `createRouter`.** Use this when you need custom networks, multiple payees, non-standard assets, or any setting `createRouterFromEnv` doesn't expose. `createRouter` runs the same validation against the `RouterConfig` shape.

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
  .method('GET')
  .handler(async ({ wallet }) => getStatus(wallet));
```

```typescript
// app/api/health/route.ts
export const GET = router.route({ path: 'health' })
  .unprotected()
  .method('GET')
  .handler(async () => ({ status: 'ok' }));
```

> **The exported const name and `.method()` are independent.** The name you export (`GET`/`POST`) controls which verb Next.js serves; `.method()` controls the verb advertised in discovery output (OpenAPI). The router defaults to `POST` (or `GET` when `.query()` is used) — so any other GET route must chain `.method('GET')` explicitly or discovery will advertise the wrong verb.

### 3. Auto-discovery

The router generates two recommended discovery surfaces. Mount both — agents look for each of them:

```typescript
// app/openapi.json/route.ts — OpenAPI 3.1, served at GET <origin>/openapi.json
import { router } from '@/lib/router';
import '@/lib/routes-barrel';  // imports every route module so the registry is populated
export const GET = router.openapi();
```

```typescript
// app/llms.txt/route.ts — plain-text agent guidance, served at GET <origin>/llms.txt
import { router } from '@/lib/router';
export const GET = router.llmsTxt();
```

The barrel forces every route module to load before the discovery handlers walk the registry. Next.js otherwise lazy-loads route files on first hit, and unloaded routes don't appear in the spec (`llms.txt` renders from static config only, so it doesn't need the barrel).

> **Deprecated:** `router.wellKnown()` (the `/.well-known/x402` resource listing) is no longer a recommended discovery surface. The handler still works if you already serve it — existing x402-native clients won't break — but new integrations should rely on `/openapi.json` and `/llms.txt`.

### 4. Unmatched route fallback

```typescript
// app/api/[[...path]]/route.ts
import { router } from '@/lib/router';

export const GET = router.notFound();
export const POST = router.notFound();
export const DELETE = router.notFound();
export const PUT = router.notFound();
export const PATCH = router.notFound();
```

This catches stale agent calls to API paths that no longer exist and returns a JSON 404 telling the client to rediscover the origin. (The [catch-all hosting mode](#hosting) does this automatically — `router.fetch` answers unmatched paths with the same envelope.)

## Hosting

The router speaks Web-standard `Request`/`Response` and dispatches through an embedded [Hono](https://hono.dev) app, so the same route definitions run on any fetch runtime. Three hosting modes:

### Next.js catch-all (recommended)

One route file serves every registered route — no per-route files, no discovery barrel:

```typescript
// app/api/[[...route]]/route.ts
import '@/lib/routes';   // side-effect import: registers all routes
import { router } from '@/lib/router';
import { nextHandlers } from '@agentcash/router/next';

export const { GET, POST, PUT, PATCH, DELETE } = nextHandlers(router);
```

The catch-all serves `/{basePath}/*` (default `/api/*`), including `/api/openapi.json` and `/api/llms.txt`. Unmatched paths get the `notFound()` rediscovery envelope automatically. The root discovery aliases (`/openapi.json`, `/llms.txt`) still need their own route files (`export const GET = router.openapi()`) or a middleware rewrite into the catch-all.

### Next.js per-file

The 1.x style — unchanged, and still the right fit when you want per-route files:

```typescript
// app/api/search/route.ts
export const POST = router.route('search').paid('0.01').body(schema).handler(handler);
```

### Hono / Bun / Node / any fetch runtime

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();
app.route('/', router.hono());   // or use router.fetch directly
serve({ fetch: app.fetch, port: 3000 });
```

`router.fetch(request)` is a standard fetch handler; `router.hono()` exposes the internal app for mounting into a larger one. See `examples/hono` for a runnable server.

### Path params and `basePath`

Route paths may declare `{param}` segments, extracted identically in every hosting mode:

```typescript
router.route('drafts/{draftId}/commit')
  .unprotected()
  .handler(async ({ params }) => commit(params.draftId));
```

`RouterConfig.basePath` (default `'api'`) controls the mount/advertised prefix: routes serve at `{baseUrl}/{basePath}/{path}`. Pass an empty string to mount at the origin root.

## Auth modes

| Method | Purpose |
|--------|---------|
| `.paid(price)` | Fixed, args-derived, or tiered payment up front (x402, MPP, or both). |
| `.upTo(maxPrice)` | Handler-computed billing; handler calls `charge(amount)` and the request settles once for the running total. **x402 only.** |
| `.session({ unitCost, maxPrice })` | Per-unit billing over an MPP payment channel (the MPP `session` intent). `.handler()` bills exactly `unitCost`; `.stream()` calls `charge()` per yield. **MPP only.** Streaming requires this. (`.metered({ tickCost, ... })` remains as a deprecated alias.) |
| `.siwx()` | Wallet identity, no payment. Returns 402 with a SIWX challenge. |
| `.apiKey(resolver)` | `X-API-Key` or `Authorization: Bearer <key>`. Composes with `.paid()` / `.upTo()` / `.session()`. |
| `.unprotected()` | No auth. |

```typescript
router.route({ path: 'admin/users' })
  .apiKey(async (key) => db.admin.findByKey(key))  // null => 401
  .handler(async ({ account }) => db.user.findMany());

router.route({ path: 'gated' })
  .apiKey(resolver).paid('0.01')  // key AND payment
  .handler(fn);
```

### `.siwx()` on paid routes. Pay once, identity-gated replays

`.paid()` and `.upTo()` compose with `.siwx()` for a pay-once-then-replay-for-free model. The first request settles normally (x402 payment); on success the wallet is recorded in the entitlement KV. Subsequent requests that present a valid SIWX signature for that wallet skip payment and run the handler directly. On `.upTo()` routes, `charge(amount)` becomes a no-op on the SIWX replay path. The handler can continue to call the route unconditionally.

```typescript
router.route({ path: 'inbox' })
  .paid('0.01').siwx()  // first call pays $0.01, later calls present a SIWX sig instead
  .handler(async ({ wallet }) => getInbox(wallet));
```

`.session()` is mutually exclusive with `.siwx()` — per-unit MPP billing has no entitlement model — and the builder throws at registration if you combine them.

> **Gotcha:** serverless / multi-instance deployments must provide a real `kvStore` (Upstash / Vercel KV). Without one the entitlement is kept in a per-process `Map`, so a wallet that paid on instance A is treated as unpaid on instance B and the user gets charged again.

## Reading a 402 challenge

What an unpaid request gets back depends on the route's auth mode:

- **Payment-only routes** (`.paid()`, `.upTo()`, `.session()` without `.siwx()`) return a 402 with an **empty body**. The entire challenge — accepts, price, schema — is base64-encoded in the `PAYMENT-REQUIRED` response header (x402 v2), with MPP challenges in `WWW-Authenticate`. Don't `res.json()` these; decode the header.
- **SIWX routes** (`.siwx()`, alone or composed with a pricing mode) return a 402 with a **JSON body** that mirrors the `PAYMENT-REQUIRED` header, including the `sign-in-with-x` extension. Header and body are always identical.

Every 402 also carries an `X-Agent-Identity` response header: an optional [DID-auth challenge](https://www.npmjs.com/package/did-auth-challenge) (nonce, domain/route binding, expiry). Clients that hold a DID may sign it and send the proof back in `X-Agent-Identity` on the retry; the verified DID is then available to handlers as `ctx.actor`. It is fully optional — it never gates the request and is unrelated to SIWX or payment. Clients without a DID can ignore it.

### When the body is validated

For args-derived (`.paid(fn)`) and tiered pricing, and for routes with `.validate()` or a checkout session, the body is parsed **before** the 402 challenge so the challenge can quote an accurate price (and `.validate()` can reject with its own status). On every other paid route, a bare unpaid probe gets its 402 **without the body being inspected** — a malformed body still yields 402, not 400. The paying retry then parses and validates the body *before* payment verification and settlement, so a 400 never costs the caller money.

`.paid()`, `.upTo()`, and `.session()` are mutually exclusive pricing modes: pick one per route.

### `.paid()`: fixed, args-derived, or tiered

**Static.**
```typescript
.paid('0.02')
```

**Args-derived.** Compute the price from the parsed body. Throw `HttpError` to reject before the 402 challenge.
```typescript
.paid((body) => calculateCost(body), { maxPrice: '5.00' })
.body(genSchema)
```

`maxPrice` caps the computed amount and acts as a fallback on non-`HttpError` exceptions thrown by the pricing function (`HttpError` is always rethrown). Without `maxPrice`, the route trusts your function fully (no cap, no fallback) and returns 500 on errors.

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

### `.upTo()`: handler-computed, x402 only

Handler calls `charge(amount)` one or more times; the request settles once for the accumulated total, capped at `maxPrice`. A `charge()` that would push the running total past `maxPrice` throws a 400 `CHARGE_OVER_CAP` error (the request fails and nothing settles) — it is not silently clamped, so guard your loop if partial work should still be billed. Requires an `'upto'` accept on at least one configured x402 network (`createRouterFromEnv` auto-adds one on Base).

```typescript
.upTo('0.05')
.body(schema)
.handler(async ({ body, charge }) => {
  await charge('0.001');
  // ... more work ...
  await charge('0.002');
  return result;
});
```

### `.session()`: per-unit, MPP only

Per-unit billing over an MPP payment channel — the MPP [`session` intent](https://mpp.dev/intents). Requires `MPP_OPERATOR_KEY` (`createRouterFromEnv` auto-enables session mode when it's set). `unitCost` maps to the MPP session challenge's per-unit `amount`; `unitType` names the unit; `maxPrice` is a router-enforced total ceiling (MPP itself only bounds spend by voucher headroom and deposit).

**Request-mode.** `.handler()` bills exactly `unitCost` on each request:
```typescript
.session({ unitCost: '0.01', maxPrice: '0.05', unitType: 'request' })
.handler(async ({ body }) => { ... });
```

**Streaming.** `.stream()` serves the session over SSE; each `charge()` call bills one unit, up to `maxPrice`:
```typescript
.session({ unitCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
.stream(async function* ({ body, charge }) {
  for await (const token of streamLLM(body.prompt)) {
    await charge();
    yield token;
  }
});
```

> `.metered({ tickCost, ... })` is the deprecated pre-1.16 spelling of `.session({ unitCost, ... })` and behaves identically.

Streaming is MPP-only. `.stream()` on a `.paid()` / `.upTo()` / `.unprotected()` route throws at registration.

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

Pipeline order on these routes: `body parse -> validate -> 402 challenge -> payment -> handler`. (`.validate()` is one of the triggers for pre-challenge body parsing — see [When the body is validated](#when-the-body-is-validated).)

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

### Debugging with `onAlert`

The router reports internal warnings and errors (failed payment verification, simulation failures, misconfiguration) through `onAlert`: with no plugin registered these messages are silently dropped, so wiring up a logging plugin is the fastest way to see why a request failed. Forward `onAlert` (and `onError`) to your logs:

```typescript
const loggingPlugin: RouterPlugin = {
  onAlert(_ctx, alert) {
    (alert.level === 'error' ? console.error : console.warn)(
      `[router:${alert.route}] ${alert.message}`,
      alert.meta ?? '',
    );
  },
  onError(_ctx, error) {
    console.error(`[router] ${error.status} ${error.message} (settled=${error.settled})`);
  },
};
```
