# `@agentcash/router` — Unified Route Builder Design

### Related documents
- **`.claude/route-registration-options.md`** — Three approaches to route registration with full code stubs. Explains why Approach B (self-register + validated barrel) was chosen.
- **`.claude/agent-discovery-final.md`** — How agentcash MCP clients discover and invoke paid API endpoints (Phases 0-3). Context for why OpenAPI/discovery generation matters.

---

## Cross-Service Audit

### Services analyzed

| Service | Framework | Route builder? | x402 | SIWX | Dynamic pricing | Async jobs | Telemetry | Hot wallet | OpenAPI |
|---------|-----------|---------------|------|------|-----------------|------------|-----------|------------|---------|
| **enrichx402** | Next.js App Router | Yes (`X402RouteBuilder`) | Yes | No | No | No | Yes (ClickHouse) | No | Yes (auto) |
| **stablestudio** | Next.js App Router | No (model registry) | Yes (manual) | Yes | Yes (tiers, per-second, size multiplier) | Yes (Vercel Workflows) | Yes (ClickHouse) | No | Yes (manual) |
| **x402email** | Next.js App Router | Partial (4/24 routes) | Yes (mixed) | Yes (11 routes) | No | No | **No** | Yes (refund + treasury sweep) | No (just .well-known) |
| **agentfacilitator** | Next.js App Router | No | Yes (1 route) | Yes (4 routes) | Yes (deposit amount) | No | **No** | Yes (notifications + refund) | No (just .well-known) |
| **agentupload** | Next.js App Router | No | Yes (1 route, manual) | Yes (2 routes) | Tier-based | No | **No** | No | No (just .well-known) |

### Common constants

- All services: **Next.js App Router**, Zod validation, `@x402/core` + `@x402/evm` + `@x402/extensions`, `@coinbase/x402` facilitator
- All services: Base mainnet (`eip155:8453`), USDC, `exact` scheme
- All services: `.well-known/x402` discovery, `llms.txt`
- No service actually implements MPP yet (enrichx402 doc mentions it aspirationally)

### Boilerplate inventory (what the package must eliminate)

**1. x402 payment ceremony (~80-150 lines per paid route)**
Every service reimplements: check payment header → decode → build requirements → find match → verify → settle → extract wallet → handle failure. This is the #1 source of duplication.

**2. SIWX auth ceremony (~20-40 lines per SIWX route)**
Every SIWX route: check header → if missing return 402 challenge → parse → validate → verify signature → extract wallet. x402email has 11 copies, agentfacilitator has 4, agentupload has 2, stablestudio has 3.

**3. Zod validation + error formatting (~15 lines per route)**
`await request.json()` → `schema.safeParse()` → format error issues → return 400. Copy-pasted everywhere.

**4. Bazaar discovery extension (~20 lines per paid route)**
`z.toJSONSchema(bodySchema)` → `z.toJSONSchema(outputSchema)` → `declareDiscoveryExtension()` → build routeConfig. Same everywhere.

**5. x402 server singleton + facilitator init (~40 lines per service)**
`x402ResourceServer` + `HTTPFacilitatorClient` + `registerExactEvmScheme` + bazaar extension + init retry. Identical across all 5 services.

**6. .well-known/x402 + OpenAPI generation**
Every service hand-builds a discovery document. Only enrichx402 auto-generates it from the route registry.

---

## Design: `@agentcash/router`

### Guiding principles

1. **A route definition is 3-6 lines.** Schema + auth/pricing + handler. Everything else is derived.
2. **Single source of truth.** Route registry drives: discovery, OpenAPI, pricing, Bazaar schemas. No parallel registries.
3. **Auth and pricing are orthogonal.** A route can be: free, SIWX-only, x402-paid (static or dynamic), API-key-protected, or unprotected. These compose, not inherit.
4. **Observability is pluggable and invisible.** The router fires lifecycle hooks (telemetry + alerting); what observes them is a `RouterPlugin`. No-op default, ClickHouse+Discord via private plugin. Zero boilerplate either way.
5. **The package owns the x402 server lifecycle.** Facilitator init, retry, settlement hooks — all handled once.
6. **Convention over configuration.** Sane defaults for Base mainnet, USDC, exact scheme. Override only when needed.
7. **Compose, don't reimplement.** The package owns zero payment or auth protocol logic. It delegates entirely to existing libraries and composes them.
8. **`zod-openapi` for OpenAPI generation.** The router uses `zod-openapi` (by samchungy) for OpenAPI 3.1 spec generation via `createDocument()`. This produces complete, valid OpenAPI documents — not JSON Schema fragments. It uses Zod v4's native `.meta()` for metadata (no monkey-patching), handles `$ref` → `#/components/schemas/` rewriting, correct `anyOf`/`oneOf` semantics for unions, parameter extraction, and input/output schema differentiation. The raw `z.toJSONSchema()` only produces JSON Schema fragments and would require building the entire OpenAPI document layer ourselves. `zod-openapi` is a peer dependency.
9. **Make invalid states unrepresentable.** If a combination of options is invalid, the type system should reject it at compile time. If a runtime invariant can be checked at route registration (cold start), check it there — never at request time. The user should discover every misconfiguration immediately, not on the first paid request at 2am.

### Why a fluent builder, not a config object

We evaluated two API styles — a fluent builder chain vs a single config object:

```typescript
// Fluent builder (chosen)
export const POST = router.route('exa/search')
  .paid('0.02')
  .body(searchRequestSchema)
  .output(searchResponseSchema)
  .handler(async ({ body }) => search(body));

// Config object (rejected)
export const POST = router.route('exa/search', {
  price: '0.02',
  body: searchRequestSchema,
  output: searchResponseSchema,
  handler: async ({ body }) => search(body),
});
```

Both are ~equal in conciseness and safety. The config object's "required property" catches a missing handler at compile time. But the builder catches it equally well — `.handler()` is the terminal method that compiles the builder into a request handler function. Without it, `export const POST` is assigned a `RouteBuilder` object, which fails both TypeScript (wrong type for a route export) and runtime (Next.js can't invoke a non-function).

The builder wins on **progressive discoverability**: after `.paid()`, the IDE only shows methods valid for paid routes (`.body()`, `.output()`, `.handler()`). After `.siwx()`, a different set. The config object shows every possible field at once — flatter but noisier. For a package that newcomers will learn through autocomplete, the builder's guided narrowing is a meaningful DX advantage.

### Composition architecture

**Key decision: use `x402ResourceServer` primitives directly, not `withX402`.**

`withX402` from `@x402/next` is a convenience wrapper, but it:
- Drops the verified payer address (R1)
- Generates 402 responses internally with no dual-protocol hook (R2)
- Consumes the request body via DynamicPrice before the handler sees it (R3)
- Doesn't catch handler throws (R5)

The `x402ResourceServer` exposes every step as a composable primitive. The builder orchestrates these directly, gaining full control over wallet injection, body buffering, error handling, and multi-protocol 402 construction.

**Library primitives the builder delegates to (never reimplements):**

| Step | Library call | What it does |
|------|-------------|-------------|
| Build x402 price requirements | `server.buildPaymentRequirementsFromOptions(options, ctx)` | Resolves dynamic payTo/price, returns `PaymentRequirements[]` |
| Build x402 402 payload | `server.createPaymentRequiredResponse(reqs, resource, err, extensions)` | Returns `PaymentRequired` object |
| Encode x402 402 header | `encodePaymentRequiredHeader(paymentRequired)` from `@x402/core/http` | Base64 encode for `PAYMENT-REQUIRED` header |
| Decode x402 payment header | `decodePaymentSignatureHeader(header)` from `@x402/core/http` | Base64 decode `PAYMENT-SIGNATURE` / `X-PAYMENT` |
| Match x402 payment to requirements | `server.findMatchingRequirements(available, payload)` | Returns matching `PaymentRequirements` |
| Verify x402 payment | `server.verifyPayment(payload, requirements)` | Returns `VerifyResponse { isValid, payer }` |
| Settle x402 payment | `server.settlePayment(payload, requirements)` | Returns `SettleResponse { success, payer, transaction, network }` |
| Encode x402 settlement header | `encodePaymentResponseHeader(settleResponse)` from `@x402/core/http` | Base64 encode for `PAYMENT-RESPONSE` header |
| Build MPP challenge | `Challenge.fromIntent(intent, { secretKey, realm, request })` from `mpay` | Stateless HMAC-bound challenge |
| Serialize MPP challenge header | `Challenge.serialize(challenge)` from `mpay` | For `WWW-Authenticate: Payment ...` header |
| Extract MPP credential | `Credential.fromRequest(request)` from `mpay` | Parses `Authorization` header |
| Verify MPP challenge HMAC | `Challenge.verify(challenge, { secretKey })` from `mpay` | Stateless — no DB |
| Verify MPP on-chain | `tempo.charge(config).verify(credential)` from `mpay/server` | On-chain Tempo transaction verification |
| Build MPP receipt | `Receipt.from({ method, status, reference, timestamp })` from `mpay` | For `Payment-Receipt` header |
| Serialize MPP receipt | `Receipt.serialize(receipt)` from `mpay` | Base64url encode |
| Enrich Bazaar extensions | `server.enrichExtensions(declared, transportCtx)` | Injects HTTP method into Bazaar schema |
| Declare Bazaar extension | `declareDiscoveryExtension(config)` from `@x402/extensions/bazaar` | Zod → JSON Schema for input/output |
| Parse SIWX header | `parseSIWxHeader(header)` from `@x402/extensions/sign-in-with-x` | Decodes `SIGN-IN-WITH-X` header |
| Validate SIWX message | `validateSIWxMessage(payload, uri, { checkNonce })` | Checks domain, URI, expiry, nonce |
| Verify SIWX signature | `verifySIWxSignature(payload)` | EIP-191 signature verification |
| Zod validation | `schema.safeParse(input)` | Body/query validation |
| Zod → JSON Schema (Bazaar) | `z.toJSONSchema(schema, { target: 'draft-2020-12' })` | For Bazaar discovery extensions |
| Zod → OpenAPI spec | `createDocument()` from `zod-openapi` | Full OpenAPI 3.1 document from Zod schemas |

**What the builder owns (~100 lines of orchestration):**

1. **Request orchestration loop** — the flow described below
2. **Body buffering** — pre-read + cache before any library touches the stream
3. **Error boundary** — try/catch around handler, convert throws to NextResponse
4. **SIWX nonce store** — in-memory TTL dedup (pluggable)
5. **Fluent builder API** — `.paid()` / `.siwx()` / `.body()` / `.handler()`
6. **Route registry** — auto-registration for OpenAPI + discovery
7. **Plugin hooks** — fires `RouterPlugin` lifecycle events (telemetry + alerting) at each orchestration step

### Request orchestration flow

This is the core of the builder — what `.handler()` compiles into. Every step is a library call except the orchestration itself.

```
Request arrives
│
├─ 1. DETECT AUTH/PAYMENT from headers:
│     ├─ PAYMENT-SIGNATURE or X-PAYMENT    → x402 path
│     ├─ Authorization (MPP credential)    → MPP path
│     ├─ SIGN-IN-WITH-X                   → SIWX path (free)
│     └─ None                             → 402 challenge (FAST EXIT)
│
│  ┌─ 402 CHALLENGE (no payment/auth) ────────────────────┐
│  │  No body parsing. No Zod validation. Fast exit.       │
│  │                                                       │
│  │  price = static price or maxPrice (for dynamic/tiered)│
│  │  x402Reqs = server.buildPaymentRequirementsFromOpts() │
│  │  x402Body = server.createPaymentRequiredResponse(     │
│  │               x402Reqs, resourceInfo, null, exts)     │
│  │  mppChallenge = Challenge.fromIntent(intent, params)  │
│  │                                                       │
│  │  return NextResponse(null, {                          │
│  │    status: 402,                                       │
│  │    headers: {                                         │
│  │      'PAYMENT-REQUIRED': encodePaymentRequiredHeader( │
│  │                            x402Body),                 │
│  │      'WWW-Authenticate': Challenge.serialize(         │
│  │                            mppChallenge),             │
│  │    }                                                  │
│  │  })                            ← R2 SOLVED            │
│  └───────────────────────────────────────────────────────┘
│
│  (auth/payment header present — this is the "real" request)
│
├─ 2. BODY BUFFER (if .body() chained) (solves R3)
│     rawBody = await request.text()
│     parsed JSON cached for reuse
│
├─ 3. ZOD VALIDATE
│     bodySchema.safeParse(body) or querySchema from URL params
│     → 400 on failure with formatted Zod issues
│
├─ 4. COMPUTE PRICE (has parsed body — no stream issue)
│     static: use as-is
│     dynamic fn: call with parsed body
│     tiered: lookup from field in parsed body
│
│  ┌─ x402 PATH ──────────────────────────────────────────┐
│  │  payload  = decodePaymentSignatureHeader(header)      │
│  │  reqs     = server.buildPaymentRequirementsFromOpts() │
│  │  matching = server.findMatchingRequirements(reqs, pl) │
│  │  verify   = await server.verifyPayment(pl, matching)  │
│  │  if (!verify.isValid) → 402                           │
│  │  wallet   = verify.payer          ← R1 SOLVED         │
│  │  response = safeCallHandler({ body, wallet })  ← R5   │
│  │  if (response.status < 400):                          │
│  │    settle = await server.settlePayment(pl, matching)  │
│  │    response.headers.set('PAYMENT-RESPONSE', encode()) │
│  │  return response                                      │
│  └───────────────────────────────────────────────────────┘
│
│  ┌─ MPP PATH ───────────────────────────────────────────┐
│  │  credential = Credential.fromRequest(request)         │
│  │  challenge  = rebuild from credential.id + secretKey  │
│  │  if (!Challenge.verify(challenge, { secretKey })) 402 │
│  │  verifyResult = await tempoCharge.verify(credential)  │
│  │  wallet = credential payer address                    │
│  │  response = safeCallHandler({ body, wallet })         │
│  │  if (response.status < 400):                          │
│  │    receipt = Receipt.from({ method, status, ref })    │
│  │    response.headers.set('Payment-Receipt',            │
│  │      Receipt.serialize(receipt))                      │
│  │  return response                                      │
│  └───────────────────────────────────────────────────────┘
│
│  ┌─ SIWX PATH ──────────────────────────────────────────┐
│  │  payload = parseSIWxHeader(header)                    │
│  │  valid   = validateSIWxMessage(payload, uri, {        │
│  │              checkNonce: nonceStore.check  ← R4       │
│  │            })                                         │
│  │  verified = verifySIWxSignature(payload)              │
│  │  wallet   = verified.address                          │
│  │  return safeCallHandler({ body, wallet })             │
│  └───────────────────────────────────────────────────────┘
```

### `safeCallHandler` — error boundary (R5)

```typescript
async function safeCallHandler<T>(
  handler: (ctx: HandlerContext) => Promise<T>,
  ctx: HandlerContext,
): Promise<NextResponse> {
  try {
    const result = await handler(ctx);
    // Plain object → auto-wrap in NextResponse.json
    if (result instanceof Response) return result as NextResponse;
    return NextResponse.json(result);
  } catch (error) {
    // HttpError → use its status code
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
```

Guarantees:
- Throws never escape to settlement logic
- Error responses always have `status >= 400` → settlement skipped for both x402 and MPP
- Plain objects auto-wrapped to `NextResponse.json()`
- `HttpError` with custom status codes (e.g. 504 for timeouts) preserved

### SIWX nonce dedup (R4)

```typescript
/** Pluggable nonce store. Default: in-memory with TTL. */
interface NonceStore {
  /** Returns false if nonce was already seen (replay). */
  check(nonce: string): Promise<boolean>;
}

/** Default: in-memory Map with TTL eviction. */
class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>(); // nonce → expiry timestamp

  async check(nonce: string): Promise<boolean> {
    this.evict();
    if (this.seen.has(nonce)) return false; // replay
    this.seen.set(nonce, Date.now() + 5 * 60 * 1000); // 5min TTL
    return true;
  }

  private evict() {
    const now = Date.now();
    for (const [n, exp] of this.seen) {
      if (exp < now) this.seen.delete(n);
    }
  }
}
```

Wired into the SIWX path via `validateSIWxMessage`'s existing `checkNonce` option:

```typescript
const result = await validateSIWxMessage(payload, resourceUri, {
  checkNonce: (nonce) => nonceStore.check(nonce),
});
```

Services that need cross-process durability (e.g., x402email's DB-backed nonces) provide a custom adapter:

```typescript
const router = createRouter({
  siwx: { nonceStore: new PrismaNonceStore(db) },
});
```

The in-memory default is sufficient for Vercel serverless: each function process is isolated, nonces are only valid for 5 minutes, and rapid replay within a warm function is the primary attack vector.

### Body buffering (R3)

**Decision: the router only touches the request body when `.body()` is chained. No `.body()` → stream untouched.**

Two modes, determined at route registration:

**Mode 1: `.body(schema)` chained** — the router owns the body.

```typescript
// 1. Read body exactly once, before any library touches the stream
const rawText = await request.text();
const rawBody = rawText ? JSON.parse(rawText) : undefined;

// 2. Zod validate against cached body
const parsed = bodySchema.safeParse(rawBody);

// 3. Dynamic price gets the parsed, validated output (no stream race)
const price = typeof pricing === 'function'
  ? await pricing(parsed.data)
  : pricing;
```

The handler receives `ctx.body` (parsed + validated). `ctx.request` has its body stream consumed — this is fine because the handler has `ctx.body`. The plugin's `RequestMeta.body` gets the raw text.

**Mode 2: no `.body()` chained** — the router never calls `request.text()`.

The request is passed through pristine. The handler receives `ctx.body` as `undefined` and `ctx.request` with its body stream intact. The handler can call `request.formData()`, `request.blob()`, `request.arrayBuffer()` — whatever it needs. The plugin's `RequestMeta.body` is `null`.

This is enforced by the type system (see safety section below). Dynamic and tiered pricing require a parsed body to compute the price, so `.paid(fn)` and `.paid({ field, tiers })` make `.body()` mandatory — `.handler()` is only available after `.body()` is chained. Static pricing (`.paid('0.01')`) makes `.body()` optional.

**Why not always buffer and reconstruct?** Reconstructing a `Request` from buffered text doesn't preserve `Content-Type: multipart/form-data` boundaries correctly. `new Request(url, { body: rawText })` produces a text body, not a multipart body. The only safe option for non-JSON routes is to never touch the stream.

### Compile-time and runtime safety

**Philosophy: if the router can prevent a misconfiguration, it must — at the earliest possible moment.** Compile-time beats registration-time beats request-time. The developer should never discover a wiring bug from a user's failed payment.

**Compile-time (TypeScript progressive narrowing):**

The fluent builder uses conditional return types so that only valid next steps are available. Invalid chains produce type errors before the code runs.

```typescript
// Static price → .body() optional, .handler() available immediately
router.route('search').paid('0.01').handler(...)                    // ✓
router.route('search').paid('0.01').body(schema).handler(...)       // ✓

// Dynamic price → .body() required, .handler() NOT available until .body()
router.route('gen').paid((body) => cost(body)).handler(...)         // ✗ type error
router.route('gen').paid((body) => cost(body)).body(schema).handler(...)  // ✓

// Tiered price → .body() required (need to read tier field from body)
router.route('upload').paid({ field: 'tier', tiers }).handler(...) // ✗ type error
router.route('upload').paid({ field: 'tier', tiers }).body(schema).handler(...)  // ✓

// Missing auth → .handler() not available
router.route('search').body(schema).handler(...)                   // ✗ type error

// Double auth → second auth method not available
router.route('search').paid('0.01').siwx()                         // ✗ type error
```

The key mechanism: `.paid(fn)` returns a builder type where `.handler()` doesn't exist. Only `.body()` returns the type that has `.handler()`. This is pure TypeScript — no runtime overhead, no decorators, no reflection.

**Registration-time (route definition, runs once at cold start):**

These checks run when the route module is imported — on Vercel cold start, on dev server boot, in test setup. They throw immediately with actionable error messages.

| Check | Error |
|-------|-------|
| Dynamic pricing without `maxPrice` | `route 'generate': dynamic pricing requires maxPrice option` |
| Route key already registered | `route 'exa/search': already registered (duplicate route key)` |
| Tier key in `tiers` is empty string | `route 'upload': tier key cannot be empty` |
| `maxPrice` is not a valid decimal string | `route 'generate': maxPrice '0' must be a positive decimal string` |

**Barrel validation (first request to OpenAPI/discovery):**

When `createRouter({ prices: {...} })` provides a price map, the first request to `router.openapi()` or `router.wellKnown()` validates that every key in `prices` has a corresponding registered route. This catches missing barrel imports.

| Check | Error |
|-------|-------|
| Price key with no registered route | `route 'exa/search' is in prices map but not registered — add it to lib/routes/barrel.ts` |

This runs once, on the first discovery request, not on every request. The error is loud and specific.

**Request-time (only for things that depend on the request):**

The orchestration only validates things that genuinely vary per request:
- Zod validation failure → 400
- Unknown tier key in request body → 400
- Payment amount insufficient → 402
- Nonce replay → 402
- SIWX expired → 402

Nothing that could have been caught earlier reaches this point.

### PluginContext lifecycle

When no plugin is configured, the router creates a **default `PluginContext`** internally — a plain object with the identity fields from the request headers and a working `setVerifiedWallet` that updates the handler's `wallet` field. This is not a no-op; the context always exists and always works. The no-op is only on the *hooks* — they don't fire.

```typescript
// Internal: the router always creates a context, plugin or not
const ctx: PluginContext = plugin?.onRequest?.(meta) ?? defaultContext(meta);
```

`setVerifiedWallet(address)` always updates the context's `verifiedWallet` AND the handler's `wallet` field. The plugin, if present, can observe the change via subsequent hooks (e.g. `onResponse` sees the final `verifiedWallet`). But the state mutation is router-owned, not plugin-owned. This ensures API-key routes can always set a verified wallet regardless of plugin config.

### Package structure

```
@agentcash/router
├── src/
│   ├── index.ts              # createRouter(), re-exports
│   ├── builder.ts            # RouteBuilder class (fluent API)
│   ├── orchestrate.ts        # Request orchestration loop (the flow above)
│   ├── protocols/
│   │   ├── x402.ts           # x402 verify + settle using server primitives
│   │   ├── mpp.ts            # MPP challenge + credential + receipt using mpay
│   │   └── detect.ts         # Header-based protocol detection
│   ├── auth/
│   │   ├── siwx.ts           # SIWX verify with nonce store
│   │   ├── api-key.ts        # API key lookup (user-provided fn)
│   │   └── nonce.ts          # NonceStore interface + MemoryNonceStore
│   ├── server.ts             # x402ResourceServer singleton + facilitator lifecycle
│   ├── registry.ts           # Global route registry (drives discovery + OpenAPI)
│   ├── handler.ts            # safeCallHandler error boundary
│   ├── body.ts               # Body buffering + Zod validation
│   ├── discovery/
│   │   ├── well-known.ts     # Auto .well-known/x402 + .well-known/mpp handlers
│   │   └── openapi.ts        # Auto OpenAPI 3.1 spec generation
│   ├── plugin.ts             # RouterPlugin interface + no-op default + consolePlugin
│   └── types.ts              # Shared types, HttpError, HandlerContext
```

**Peer dependencies:**

```json
{
  "peerDependencies": {
    "next": ">=15.0.0",
    "zod": "^4.0.0",
    "@x402/core": "^2.3.0",
    "@x402/evm": "^2.3.0",
    "@x402/extensions": "^2.3.0",
    "@coinbase/x402": "^2.1.0",
    "zod-openapi": "^5.0.0",
    "mpay": "^0.2.4"
  },
  "peerDependenciesMeta": {
    "mpay": { "optional": true }
  }
}
```

Note: `@x402/next` is **no longer a dependency**. The builder uses `@x402/core/server` and `@x402/core/http` directly. `mpay` is optional — required only when routes declare MPP support.

### Core API

#### 1. Service initialization (once per service)

```typescript
// lib/routes.ts (per-service)
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  // Required
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,

  // Optional: RouterPlugin for observability (telemetry + alerting)
  // plugin: myPlugin(),

  // Optional overrides
  network: 'eip155:8453',           // default
});
```

`createRouter()` returns a `ServiceRouter` which:
- Creates and initializes the x402 server singleton (with retry)
- Initializes telemetry
- Returns `router.route()` for defining routes
- Returns `router.wellKnown()` for auto-discovery handler
- Returns `router.openapi()` for auto-OpenAPI handler
- Exposes `router.registry` for programmatic access

#### 2. Route definitions

**Static-priced sync route (enrichx402 pattern)**

```typescript
// app/api/exa/search/route.ts
import { router } from '@/lib/routes';

export const POST = router.route('exa/search')
  .paid('0.01')
  .body(searchRequestSchema)
  .output(searchResponseSchema)
  .description('Exa Search - Neural search across the web')
  .handler(async ({ body }) => search(body));
```

**SIWX-only route (x402email, agentupload pattern)**

```typescript
// app/api/inbox/status/route.ts
export const GET = router.route('inbox/status')
  .siwx()
  .query(statusQuerySchema)
  .output(statusResponseSchema)
  .description('Get inbox status')
  .handler(async ({ query, wallet }) => getStatus(query, wallet));
```

**Dynamically-priced route (stablestudio pattern)**

```typescript
// app/api/x402/[model]/[operation]/route.ts
export const POST = router.route('generate')
  .paid((body) => calculateOperationCost(body), { maxPrice: '5.00' })
  .body(generateSchema)
  .output(jobResponseSchema)
  .description('Generate image/video')
  .handler(async ({ body, wallet }) => {
    const job = await createJob(body, wallet);
    return { jobId: job.id, status: 'pending' };
  });
```

**Tier-priced route (agentupload pattern)**

```typescript
// app/api/x402/upload/route.ts
export const POST = router.route('upload')
  .paid({ field: 'tier', tiers: {
    '10mb':  { price: '0.02',  label: '10 MB' },
    '100mb': { price: '0.20',  label: '100 MB' },
    '1gb':   { price: '2.00',  label: '1 GB' },
  }})
  .body(uploadSchema)
  .output(uploadResponseSchema)
  .handler(async ({ body, wallet }) => handleUpload(body, wallet));
```

**API key route (agentfacilitator pattern)**

```typescript
// app/api/facilitator/v2/[id]/settle/route.ts
export const POST = router.route('facilitator/settle')
  .apiKey((key) => db.account.findUnique({ where: { apiKey: key } }))
  .paid('0.01')
  .body(settleSchema)
  .handler(async ({ body, account }) => settlePayment(body, account));
```

**Free/unprotected route**

```typescript
// app/api/health/route.ts
export const GET = router.route('health')
  .unprotected()
  .handler(async () => ({ status: 'ok' }));
```

#### 3. Auto-discovery

```typescript
// app/.well-known/x402/route.ts
import { router } from '@/lib/routes';
export const GET = router.wellKnown({
  instructions: () => fetch('/llms.txt').then(r => r.text()), // or inline
  ownershipProofs: ['0x...'],
});

// app/openapi.json/route.ts
export const GET = router.openapi({
  title: 'enrichx402 API',
  version: '1.0.0',
});
```

Both handlers read from `router.registry` — the same registry populated by `.route()` calls. No parallel list to maintain.

### Handler context

Every handler receives a typed context based on what auth/schema methods were chained:

```typescript
type HandlerContext<TBody, TQuery> = {
  body: TBody;                        // parsed + validated (if .body())
  query: TQuery;                      // parsed + validated (if .query())
  request: NextRequest;               // raw request (escape hatch)
  wallet: string | null;              // verified wallet (from x402 payment, MPP, or SIWX)
  account?: unknown;                  // from .apiKey() resolver
  alert: AlertFn;                     // fire alert → plugin.onAlert(). No-op if no plugin.
  setVerifiedWallet: (addr: string) => void; // manual wallet (API-key routes)
};
```

- For `.paid()` routes: `wallet` is extracted from the verified payment payload (cryptographically proven, not from a header)
- For `.siwx()` routes: `wallet` is extracted from the verified SIWX signature
- For `.apiKey()` routes: `account` is whatever the resolver function returns
- `setVerifiedWallet` is for API-key or custom auth routes that resolve wallet manually
- `alert()` lets the handler raise alerts (provider degradation, rate limits, etc.) — the `RouterPlugin` decides delivery

### Pricing model detail

```typescript
type PricingConfig =
  // Static: fixed price string
  | string                                        // '0.01'

  // Dynamic: function from parsed Zod body to price string
  | ((body: TBody) => string | Promise<string>)

  // Tiered: lookup from a field in the input
  | {
      field: string;                               // 'tier' or 'quality'
      tiers: Record<string, { price: string; label?: string }>;
      default?: string;                            // fallback tier key
    };
```

**How dynamic/tiered pricing interacts with the 402 → payment → verify cycle:**

The x402 protocol works in two round-trips: (1) agent sends request with no payment, gets a 402 with the price, (2) agent signs payment for that price and retries. The price in the 402 is the price the agent will pay. This creates a tension with dynamic pricing — the real price depends on the body, but the body only arrives in the second request.

**Resolution: the 402 contains a maximum price. The actual price is validated on the paid request.**

```
Round 1: Agent → server (no payment, no body)
  Server returns 402 with maxPrice from route config
  Bazaar extension describes tiers/ranges in schema

Round 2: Agent → server (payment signed for maxPrice, body included)
  Server computes actualPrice from body
  if actualPrice > payment.amount → 402 with actualPrice (re-challenge)
  if actualPrice <= payment.amount → verify + settle for actualPrice
```

For each pricing mode:
- **Static**: 402 price = actual price. No ambiguity.
- **Dynamic fn**: Builder requires `.maxPrice('0.10')` on the route. The 402 contains this max. The fn computes the actual price from the body on the paid request. If actual > max, the route config is wrong (build-time error or critical alert). If actual <= paid amount, settle for actual.
- **Tiered**: 402 contains the most expensive tier (conservative — agent is never underbilled). Bazaar extension lists all tiers with prices so the agent can choose. On the paid request, the tier resolves from the body field and is validated against the payment amount.

```typescript
// Dynamic: maxPrice required
router.route('generate')
  .paid((body) => calculateCost(body), { maxPrice: '2.00' })
  .body(generateSchema)
  .handler(...)

// Tiered: maxPrice derived automatically from highest tier
router.route('upload')
  .paid({ field: 'tier', tiers: {
    '10mb':  { price: '0.02' },
    '100mb': { price: '0.20' },
    '1gb':   { price: '2.00' },  // ← 402 shows this price
  }})
  .body(uploadSchema)
  .handler(...)
```

**What x402 does under the hood:** `findMatchingRequirements` checks `payload.accepted` against `available` requirements. The builder builds requirements with the actual computed price, then checks if the payment covers it. If the agent overpaid (signed for maxPrice but actual was cheaper), the settlement is for the lower amount — the agent keeps the difference. This is the same "max price" pattern that `withX402`'s `DynamicPrice` uses today.

### Auth composition

Auth modes are **mutually exclusive per route** (a route is paid OR siwx OR apiKey OR unprotected). But a service can have routes of different types:

```typescript
router.route('send').paid('0.02').body(...)        // x402 payment
router.route('status').siwx().query(...)           // SIWX identity
router.route('proxy').apiKey(lookup).paid('0.01')  // API key + payment (composable)
router.route('health').unprotected()               // open
```

The one exception: `.apiKey()` can compose with `.paid()` (agentfacilitator's settle route needs both API key validation AND payment). In this case, the API key is checked first, then payment.

### Settlement gating

The builder automatically prevents settlement when the handler fails:
- Handler throws → no settlement, payment refunded
- Handler returns → settlement proceeds
- Handler returns a response with status >= 400 → no settlement (enrichx402's current behavior)
- `ApiTimeoutError` → converted to 504, no settlement, "client not charged" message

### x402 server lifecycle

The package manages the full lifecycle:

```typescript
// Internal — not exposed to consumers
const server = new x402ResourceServer(new HTTPFacilitatorClient(facilitator));
registerExactEvmScheme(server);
server.registerExtension(bazaarResourceServerExtension);

// Init with retry (handles 429 rate limits on cold start)
const initPromise = retryInit(server, { maxAttempts: 3, backoff: [1000, 2000, 4000] });

// Every route handler awaits init before processing
```

The `x402ResourceServer` also exposes verify and settlement lifecycle hooks that the router wires to the `RouterPlugin`:

```typescript
// Verify hooks
server.onBeforeVerify(ctx => { ... });
server.onAfterVerify(ctx => { ... });    // ctx has { paymentPayload, requirements, result: VerifyResponse }
server.onVerifyFailure(ctx => { ... });  // ctx has { paymentPayload, requirements, error }

// Settlement hooks
server.onBeforeSettle(ctx => { ... });   // can return { abort: true, reason } to cancel
server.onAfterSettle(ctx => { ... });    // ctx has { paymentPayload, requirements, result: SettleResponse }
server.onSettleFailure(ctx => { ... });  // can return { recovered: true, result } for retry
```

The router uses these to bridge x402 server events into the `RouterPlugin` — `onAfterSettle` → `plugin.onPaymentSettled()`, `onSettleFailure` → `plugin.onAlert('critical', ...)`. This means the router doesn't need its own post-settlement observation — it delegates to the server's hooks and forwards to the plugin.

Consumers never import `@x402/core`, `@x402/next`, `@x402/evm`, or `@coinbase/x402` directly. The route builder package is the only x402 dependency.

---

## Migration path per service

### enrichx402 (easiest — already has a builder)

Replace `lib/x402/route-builder.ts` + `lib/x402/pricing.ts` + `lib/x402/server.ts` with:
```typescript
export const router = createRouter({ payeeAddress: env.X402_PAYEE_ADDRESS, plugin: meritPlugin() });
```

Route files change from:
```typescript
import { createX402Route } from '@/lib/x402/route-builder';
export const POST = createX402Route('exa/search').body(...).output(...).handler(...);
```
To:
```typescript
import { router } from '@/lib/routes';
export const POST = router.route('exa/search').paid('0.01').body(...).output(...).handler(...);
```

Auto pricing from a central `BASE_PRICES` map can still be used — the router accepts an optional `prices` config that auto-applies pricing by route key, preserving the current DX.

**Effort**: Small. Mostly find-and-replace. OpenAPI generation migrates from custom `lib/openapi/generate.ts` to `router.openapi()`.

### x402email (high-impact — eliminates massive boilerplate)

Currently: 24 route files, two competing wrapper patterns, 11 copy-pasted SIWX blocks, no telemetry.

After:
```typescript
// lib/routes.ts
export const router = createRouter({
  payeeAddress: env.X402_PAYEE_ADDRESS,
  plugin: meritPlugin(),
});

// app/api/send/route.ts (was ~80 lines, becomes 5)
export const POST = router.route('send')
  .paid('0.02')
  .body(SendEmailRequestSchema)
  .output(sendResponseSchema)
  .description('Send an email')
  .handler(async ({ body, wallet }) => sendEmail(body, wallet));

// app/api/inbox/status/route.ts (was ~40 lines, becomes 5)
export const GET = router.route('inbox/status')
  .siwx()
  .query(statusQuerySchema)
  .output(statusResponseSchema)
  .handler(async ({ query, wallet }) => getInboxStatus(query, wallet));
```

**Effort**: Medium. 24 routes to migrate, but each becomes trivial. Gains telemetry for free. Eliminates `createX402PostRoute`, manual `withX402` wrapping, all SIWX boilerplate.

### stablestudio (medium complexity — dynamic pricing + async)

The main x402 route (`[model]/[operation]`) is ~300 lines of manual payment handling. After:

```typescript
export const POST = router.route('x402/generate')
  .paid((body) => calculateJobCostFromRegistry(body).toFixed(6), { maxPrice: '5.00' })
  .body(jobSettingsSchema)
  .output(jobResponseSchema)
  .description('Create a generation job')
  .handler(async ({ body, wallet }) => {
    const user = await ensureUser(wallet);
    const job = await createJob(body, user);
    await startWorkflow(job);
    return { jobId: job.id, status: 'pending' };
  });
```

The SIWX routes (jobs list, job status, uploads confirm) become:
```typescript
export const GET = router.route('x402/jobs')
  .siwx()
  .output(jobListSchema)
  .handler(async ({ wallet }) => listJobs(wallet));
```

**Effort**: Medium. The dynamic pricing function is already implemented (`calculateJobCostFromRegistry`), just needs to be passed to `.paid()`. The async workflow logic stays in the handler — the builder doesn't need to know about Vercel Workflows.

### agentfacilitator (small — few routes)

```typescript
// Deposit with dynamic pricing (price derived from body)
export const POST = router.route('deposit')
  .paid((body) => Math.max(body.amount, 2.50).toFixed(6), { maxPrice: '1000.00' })
  .body(DepositBodySchema)
  .description('Deposit USDC')
  .handler(async ({ body, wallet }) => deposit(body, wallet));

// SIWX routes
export const GET = router.route('balance')
  .siwx()
  .handler(async ({ wallet }) => getBalance(wallet));

// API key + payment route
export const POST = router.route('facilitator/settle')
  .apiKey((key) => db.account.findUnique({ where: { apiKey: key } }))
  .paid('0.01')
  .body(settleSchema)
  .handler(async ({ body, account }) => settleViaProxy(body, account));
```

**Effort**: Small. 6 route files.

### agentupload (small — few routes)

```typescript
export const POST = router.route('upload')
  .paid({ field: 'tier', tiers: UPLOAD_TIERS })
  .body(uploadRequestSchema)
  .output(uploadResponseSchema)
  .handler(async ({ body, wallet }) => handleUpload(body, wallet));

export const GET = router.route('uploads')
  .siwx()
  .output(uploadsListSchema)
  .handler(async ({ wallet }) => listUploads(wallet));
```

**Effort**: Small. 3 route files + cron.

---

## Relationship to `@merit-systems/x402-server-telemetry`

`@merit-systems/x402-server-telemetry` stays published on npm — it's not open source but it's not a secret either. It gets a **major version bump** that replaces the old wrapper API with a `RouterPlugin` implementation.

**Before (current v0.x):** Exports `createRouteBuilder()`, `withTelemetry()`, `withSiwxTelemetry()` — wraps route handlers with telemetry middleware. Each service wires it differently.

**After (v1.0):** Exports `meritPlugin()` — returns a `RouterPlugin` that plugs into `createRouter({ plugin: meritPlugin() })`. One function, one integration point. The old exports are removed entirely (breaking change, hence major version).

What moves into the new version:
- ClickHouse client singleton + insert logic (from current package)
- Discord webhook delivery + per-provider dedup (from enrichx402's `lib/cron/discord.ts`)
- Verified wallet extraction from payment headers
- `PluginContext` with `setVerifiedWallet` mutator
- All env var handling (`CLICKHOUSE_URL`, `DISCORD_WEBHOOK_URL`, etc.)

What's deleted:
- `createRouteBuilder()`, `withTelemetry()`, `withSiwxTelemetry()` — replaced by the router's built-in orchestration
- Any x402 payment ceremony logic — now in `@agentcash/router`

The `RouterPlugin` interface lives in `@agentcash/router` (public). The implementation lives in `@merit-systems/x402-server-telemetry` v1.0 (published, not open source). The router has no dependency on the telemetry package. The telemetry package peer-depends on `@agentcash/router` for the `RouterPlugin` type.

---

## Feature checklist

| Feature | enrichx402 | stablestudio | x402email | agentfacilitator | agentupload | Supported |
|---------|-----------|-------------|----------|-----------------|-------------|-----------|
| Static pricing | Yes | Yes | Yes | Yes | Yes | `.paid('0.01')` |
| Dynamic pricing (fn) | — | Yes | — | Yes | — | `.paid((input) => ...)` |
| Tier pricing | — | Yes | — | — | Yes | `.paid({ field, tiers })` |
| SIWX auth | — | Yes | Yes | Yes | Yes | `.siwx()` |
| API key auth | — | — | — | Yes | — | `.apiKey(resolver)` |
| Cron auth | — | Yes | Yes | Yes | Yes | Out of scope* |
| Zod body validation | Yes | Yes | Yes | Yes | Yes | `.body(schema)` |
| Zod query validation | Yes | — | — | — | — | `.query(schema)` |
| Zod output schema | Yes | Yes | Partial | — | — | `.output(schema)` |
| Bazaar discovery | Yes | Yes | Yes | Yes | Yes | Auto from schemas |
| OpenAPI generation | Yes | Manual | No | No | No | `router.openapi()` |
| .well-known/x402 | Yes | Yes | Yes | Yes | Yes | `router.wellKnown()` |
| Observability plugin | Yes | Yes | **No** | **No** | **No** | `RouterPlugin` interface (telemetry + alerting) |
| Facilitator init retry | Yes | — | — | — | — | Auto |
| Settlement gating | Yes | Yes | Yes | Yes | Yes | Auto |
| Timeout → 504 | Yes | — | — | — | — | Auto (configurable) |
| Hot wallet (outbound) | — | — | Yes | Yes | — | Out of scope* |
| Async jobs | — | Yes | — | — | — | Out of scope* |

*Hot wallet, async jobs, and cron auth are application-level concerns, not route-builder concerns. Cron routes typically use a shared secret header check (`CRON_SECRET`) — this is a simple guard that lives in the service's handler or a tiny per-service utility. The router doesn't need to own it, but it must not interfere: cron routes use `.unprotected()` and handle their own auth. The builder provides the `wallet` to the handler; what the handler does with it (start a workflow, trigger a refund) is up to the service.

---

---

## MPP (Micropayment Protocol) Support

### Current state

**No server implements MPP today.** All 5 services use x402-only with the `exact` EVM scheme on Base mainnet.

However, **agentcash MCP client already fully supports MPP** on the client side via the `mpay` npm package (v0.2.4). MPP settles on the Tempo chain (chain ID 42431, incubated by Stripe & Paradigm). x402scan-mcp does NOT support MPP.

This means: the moment a server emits MPP headers, agentcash clients can pay. The route builder should be the thing that enables this.

### How agentcash detects and uses MPP

**Protocol detection from 402 response headers:**
```
PAYMENT-REQUIRED header (base64 JSON)     → x402
WWW-Authenticate: Payment id=... realm=.. → MPP
Both headers present                       → both available, client picks by wallet balance
Neither                                    → defaults to x402
```

**MPP payment flow (client side, already implemented in agentcash):**
1. Parse `WWW-Authenticate: Payment` header via `Challenge.fromResponse()`
2. Check Tempo balance via `mppscan.com/api/balance/{address}`
3. Create credential via `mpayClient.createCredential(response)` (signs on Tempo chain)
4. Retry request with `Authorization` header containing the signed credential
5. Parse receipt from `Payment-Receipt` header (base64url JSON with `reference`, `method`, `status`, `timestamp`)

**Auto protocol selection** (when `paymentMethod: "auto"`):
- If only one protocol detected → use it
- If both detected → compare USDC (Base) balance vs Tempo balance, pick higher
- If preferred fails → fallback to the other protocol

### What the route builder must do for MPP

#### 1. Per-route protocol declaration

```typescript
// x402 only (default, current behavior)
router.route('search').paid('0.01')

// Dual protocol — accepts either x402 or MPP
router.route('search').paid('0.01', { protocols: ['x402', 'mpp'] })

// MPP only (future, if a service wants Tempo-only)
router.route('search').paid('0.01', { protocols: ['mpp'] })
```

#### 2. Dual-header 402 response

When a route supports both protocols, the 402 response must include BOTH:

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded x402 challenge JSON>
WWW-Authenticate: Payment id="<nonce>", realm="<origin>", method="tempo", intent="charge", request="<base64-encoded requirements>"
```

The x402 challenge (in `PAYMENT-REQUIRED`) contains the `accepts` array with pricing, Bazaar extensions, and SIWX info as today.

The MPP challenge (in `WWW-Authenticate`) contains the Tempo payment parameters in the standard HTTP auth challenge format.

Both headers describe the same price for the same resource — just different settlement rails.

#### 3. Dual payment acceptance

The handler wrapper must check for payment in this order:
1. `PAYMENT-SIGNATURE` or `X-PAYMENT` header → x402 flow (verify via facilitator, settle on Base)
2. `Authorization` header starting with MPP credential → MPP flow (verify credential, settle on Tempo)
3. Neither → return 402 with both challenge headers

This is a server-side middleware concern that the route builder handles transparently. The handler function never sees the protocol distinction.

#### 4. OpenAPI `x-payment-info` extension

The auto-generated OpenAPI spec must reflect the declared protocols:

```yaml
paths:
  /api/search:
    post:
      x-payment-info:
        price: 0.02
        protocols: ["x402", "mpp"]    # from route declaration
```

agentcash reads `x-payment-info.protocols` during discovery to know which protocols an endpoint supports before probing it.

#### 5. Discovery endpoints

`router.wellKnown()` should serve:
- `/.well-known/x402` — lists resources that accept x402 (all routes with `x402` in their protocols)
- `/.well-known/mpp` — lists resources that accept MPP (all routes with `mpp` in their protocols)

agentcash fetches both and merges the resource lists. A route in both lists means dual-protocol support.

#### 6. Dependencies and the `mpay` API (v0.2.4)

The `mpay` package provides both high-level framework middleware and low-level primitives.

**High-level API (`mpay/nextjs`):**

```typescript
import { Mpay, tempo } from 'mpay/nextjs';
const mpay = Mpay.create({
  methods: [tempo({ currency: '0x...', recipient: '0x...' })],
  secretKey: process.env.PAYMENT_SECRET_KEY!,
});
// Wraps a Next.js handler — handles 402, verification, receipts automatically
export const GET = mpay.charge({ amount: '1' })(() =>
  Response.json({ data: 'paid content' }),
);
```

**Why the router can't use the high-level API:** `mpay.charge()` wraps the entire handler and generates its own 402 response. The router needs to construct the 402 itself (to include both `PAYMENT-REQUIRED` for x402 AND `WWW-Authenticate` for MPP in a single response). It also needs to interleave MPP verification with body buffering, Zod validation, and plugin hooks. The high-level wrapper doesn't allow this.

**Low-level primitives the router uses instead:**

| mpay export | Import path | Server-side use |
|-------------|-------------|----------------|
| `Challenge.fromIntent(intent, { secretKey, realm, request })` | `mpay` | Stateless HMAC-bound challenge creation |
| `Challenge.serialize(challenge)` | `mpay` | For `WWW-Authenticate: Payment ...` header |
| `Challenge.verify(challenge, { secretKey })` | `mpay` | Stateless HMAC verification (returns `boolean`) |
| `Credential.fromRequest(request)` | `mpay` | Parses `Authorization` header |
| `tempo.charge(config)` | `mpay/server` | Returns a method intent with `.verify(credential)` for on-chain Tempo verification |
| `Receipt.from({ method, status, reference, timestamp })` | `mpay` | For `Payment-Receipt` header |
| `Receipt.serialize(receipt)` | `mpay` | Base64url encode |

The route builder's `protocols/mpp.ts` uses these primitives directly. It creates the `tempo.charge()` method intent at router init time, then calls `.verify(credential)` per-request for on-chain verification. The builder never implements MPP protocol logic — it's all `mpay`.

`mpay` is an optional peer dependency (`^0.2.4`) — only required when routes declare `protocols: ['mpp']`.

### Implementation

Both x402 and MPP ship together from day one. The `protocols` option defaults to `['x402']` but any route can opt into dual-protocol via `{ protocols: ['x402', 'mpp'] }`. The builder orchestrates both paths in a single request handler — no phasing, no feature flags. See the orchestration flow for the unified 402 challenge and dual payment acceptance paths.

**Why raw primitives, not `mpay/nextjs` middleware:** `mpay/nextjs` provides `mpay.charge()` which wraps an entire route handler and generates its own 402 response. This conflicts with dual-protocol support — the router must construct a single 402 with both `PAYMENT-REQUIRED` (x402) and `WWW-Authenticate` (MPP) headers. It also needs to interleave MPP verification with body buffering, Zod validation, and plugin hooks. The raw primitives (`Challenge`, `Credential`, `Receipt` from `mpay`, `tempo.charge()` from `mpay/server`) give the router full control over orchestration while delegating all protocol logic to the library.

---

## Risks and resolutions

### Resolved by using `x402ResourceServer` primitives directly

**R1. Wallet extraction.** ~~`withX402` discards `VerifyResponse.payer`.~~
**Resolved.** The builder calls `server.verifyPayment()` directly and reads `verify.payer`. No side-channel, no upstream PR needed. See x402 path in orchestration flow.

**R2. Dual-protocol 402.** ~~`withX402` and `Mpay.create()` each generate their own 402 internally.~~
**Resolved.** The builder constructs the 402 itself using `server.createPaymentRequiredResponse()` for x402 and `Challenge.fromIntent()` + `Challenge.serialize()` for MPP, combining both headers into a single `NextResponse`. See 402 challenge path in orchestration flow.

**R3. Body stream consumption.** ~~`withX402`'s DynamicPrice consumes the body stream.~~
**Resolved.** When `.body()` is chained, the builder pre-reads the body via `request.text()` after protocol detection. Dynamic price functions receive the parsed, validated Zod output — not the raw stream. When `.body()` is NOT chained (file uploads, multipart), the stream is never touched. See body buffering section.

**R5. Handler throws.** ~~`withX402` doesn't catch throws.~~
**Resolved.** `safeCallHandler` wraps every handler call in try/catch. Throws → `NextResponse.json({ success: false }, { status })`. Error responses have `status >= 400`, so settlement is always skipped on failure. See safeCallHandler section.

**R6. Static imports.** ~~`withX402` dynamically imports Bazaar extension.~~
**Resolved.** The builder pre-registers `bazaarResourceServerExtension` via static import on the `x402ResourceServer` at init time (same pattern enrichx402 already uses). No dynamic imports.

**R8. Handler return contract.** ~~`withX402` expects NextResponse.~~
**Resolved.** `safeCallHandler` converts plain objects to `NextResponse.json()` automatically. Handlers can return either plain objects or `NextResponse`.

### Resolved by design

**R4. SIWX nonce replay.**
**Resolved.** The builder provides `MemoryNonceStore` by default (in-memory Map with 5-minute TTL eviction), wired into `validateSIWxMessage`'s existing `checkNonce` callback. Services needing cross-process durability (x402email) provide a custom `NonceStore` adapter. See SIWX nonce dedup section.

### Remaining risks (low)

**R7. OpenAPI import side-effect trick.** Each route module must be explicitly imported in `openapi.json/route.ts` for the registry to be complete. enrichx402 validates at runtime against a known route list. The builder should preserve this validation and document the pattern. This is inherent to Next.js App Router's serverless model — each function gets its own module scope.

### Resolved design questions

1. **Auto-pricing registry vs explicit per-route?**
**Decision: support both.** `createRouter({ prices: { 'exa/search': '0.02', ... } as const })` provides a central map. `router.route('exa/search')` auto-looks up from the map. `.paid('0.02')` on the chain overrides explicitly. Services with many static-priced routes (enrichx402) use the map. Services with few routes or dynamic pricing define price inline.

**How it interacts with the type system:** The `prices` map must be declared `as const` so TypeScript can derive literal key types. `createRouter()` uses function overloads:

```typescript
// With prices map: route keys from the map are auto-priced.
// router.route('exa/search') returns a builder where .paid() is implicit —
// .body().handler() is available immediately (auth is pre-configured).
const router = createRouter({
  prices: { 'exa/search': '0.02', 'apollo/people-search': '0.02' } as const,
});
export const POST = router.route('exa/search')
  .body(schema).handler(...)  // ✓ — price from map, no .paid() needed

// Without prices map: explicit .paid() / .siwx() / .unprotected() required.
const router = createRouter({ payeeAddress: '0x...' });
export const POST = router.route('exa/search')
  .paid('0.02')               // ← required
  .body(schema).handler(...)
```

This replicates the current enrichx402 pattern where `RouteKey = keyof typeof BASE_PRICES` enforces valid keys at compile time and `createX402Route(routeKey)` auto-applies `getPrice(routeKey)`. Routes not in the prices map (SIWX, unprotected) still require explicit auth declaration — they bypass the map entirely.

2. **Dynamic route segments?**
**Decision: route key is a logical name, not a file path.** `router.route('generate')` can live at `app/api/x402/[model]/[operation]/route.ts`. The registry entry uses the logical key. For OpenAPI generation, the route must also declare its HTTP path if it differs from the key: `.path('/api/x402/:model/:operation')`. Default assumes `/api/{routeKey}`.

3. **How do routes get into the OpenAPI spec?**
**Decision: self-registering routes + validated barrel (Approach B).** See `.claude/route-registration-options.md` for the full evaluation of three approaches.

Each route self-registers via `router.route(...)` in its handler file — the handler file is the single source of truth for price, schemas, description, and logic. A barrel file (`lib/routes/barrel.ts`) imports all route modules so the OpenAPI/discovery endpoints can see them:

```typescript
// lib/routes/barrel.ts — just imports, no logic
import '@/app/api/exa/search/route';
import '@/app/api/apollo/people-search/route';
// ...

// app/openapi.json/route.ts
import '@/lib/routes/barrel';
export const GET = router.openapi({ title: 'enrichx402 API', version: '1.0.0' });
```

Completeness validation: the `prices` map in `createRouter()` serves as the expected route list. On first request to OpenAPI/discovery, the router checks that every key in `prices` has a corresponding registry entry. Missing import → loud error with the exact route key and a hint to add it to the barrel.

This was chosen over contract-first (splits route metadata across two files) and central-definitions (moves handler logic away from `app/api/`, creates parallel directory structure). The barrel is boring but the handler DX is the cleanest — everything about a route lives in one file.

Non-x402 routes (cron, webhooks, health checks) are completely unaffected — they don't import `router`, don't appear in the barrel, and the router touches nothing global (no middleware.ts, no request interception).

4. ~~**MPP server-side library?**~~ **Resolved.** `mpay` v0.2.4 provides both high-level middleware (`mpay/nextjs`) and low-level primitives. The router uses low-level primitives for dual-protocol support — see MPP section for details.

---

## Open Source Strategy

### Why a plugin interface — design intent

**This package is designed to be open sourced.** The `RouterPlugin` interface exists specifically because Merit Systems runs proprietary observability (ClickHouse telemetry, Discord alerting with per-provider dedup) that we do NOT want in the public repo — but we need it to plug in trivially, with zero friction, as a single import.

The constraint driving this architecture:
1. **The router itself must be fully open source** — no private dependencies, no Merit-specific code, no telemetry backend assumptions. Anyone should be able to `npm install @agentcash/router` and have a working paid API with zero observability config.
2. **Merit's observability must be a one-line addition** — not a fork, not a wrapper, not a monkey-patch. A clean interface that our private package implements, plugged in via `createRouter({ plugin: meritPlugin() })`.
3. **The interface must be bulletproof** — every lifecycle event the private plugin needs must be exposed as a hook. If we discover a new observation point later, we add a hook to the interface. We never reach into router internals. The plugin boundary is the contract.

This means the `RouterPlugin` interface IS the API surface for observability. It must be complete enough that Merit's full telemetry + alerting pipeline can be implemented without modifying the router. If it's not — the interface is wrong, not the architecture.

Future agents: if you're adding a feature to the router that has observability implications (new auth method, new payment protocol, new error class), add the corresponding hook to `RouterPlugin`. Do not add ClickHouse, Discord, or any specific backend code to the router itself. The private plugin will implement the new hook separately.

### Design goal

Two audiences, same router, same interface:

| Audience | Plugin | What they get |
|----------|--------|---------------|
| **External devs** | None, or `consolePlugin()` | Full routing, payment, discovery. Console logs or silence. |
| **Merit team** | Private `RouterPlugin` impl | All of the above + ClickHouse telemetry + Discord alerting + dedup. One import. |

The router never knows what observability backend exists. It fires hooks. What listens is up to the consumer.

### `RouterPlugin` interface

One interface for telemetry AND alerting. Every method is optional. The router calls them fire-and-forget — never awaits, never catches.

```typescript
/**
 * Plugin interface for observability (telemetry + alerting).
 *
 * The router calls these hooks at lifecycle points. All are optional.
 * All are fire-and-forget — the router never awaits them.
 * Implementations MUST catch their own errors internally.
 */
interface RouterPlugin {
  /**
   * Called once when createRouter() initializes.
   * Use for connection setup, health checks, etc.
   */
  init?(config: { origin?: string }): void | Promise<void>;

  /**
   * Called at the start of every request, before auth/payment.
   * Returns a mutable context object that the router threads through
   * the rest of the lifecycle for this request.
   */
  onRequest?(meta: RequestMeta): PluginContext;

  /**
   * Called when an x402 or MPP payment is verified (before settlement).
   */
  onPaymentVerified?(ctx: PluginContext, payment: PaymentEvent): void;

  /**
   * Called after settlement succeeds.
   */
  onPaymentSettled?(ctx: PluginContext, settlement: SettlementEvent): void;

  /**
   * Called after the response is sent (success or error). Always fires.
   */
  onResponse?(ctx: PluginContext, response: ResponseMeta): void;

  /**
   * Called when the handler throws or returns an error response.
   */
  onError?(ctx: PluginContext, error: ErrorEvent): void;

  /**
   * Called when handler code or the router itself raises an alert.
   * The SERVICE decides when to alert (via ctx.alert()).
   * The PLUGIN decides how to deliver it.
   */
  onAlert?(ctx: PluginContext, alert: AlertEvent): void;
}
```

**Supporting types:**

```typescript
/** Immutable snapshot of the incoming request (headers only — body not yet read). */
interface RequestMeta {
  requestId: string;
  method: string;
  route: string;
  origin: string;
  referer: string | null;
  walletAddress: string | null;   // X-Wallet-Address header
  clientId: string | null;        // X-Client-ID header
  sessionId: string | null;       // X-Session-ID header
  contentType: string | null;
  headers: Record<string, string>;
  startTime: number;
}

// NOTE: RequestMeta intentionally has no `body` field. `onRequest` fires at
// step 1 (protocol detection), before body buffering. The request body is
// available to plugins via `ResponseMeta.requestBody` in `onResponse`, which
// always fires. This matches the current telemetry package's behavior — it
// records the body in the response/invocation log, not at request start.

/** Mutable context threaded through a single request's lifecycle. */
interface PluginContext {
  readonly requestId: string;
  readonly route: string;
  readonly walletAddress: string | null;
  readonly clientId: string | null;
  readonly sessionId: string | null;
  verifiedWallet: string | null;
  setVerifiedWallet(address: string): void;
}

interface PaymentEvent {
  protocol: 'x402' | 'mpp';
  payer: string;
  amount: string;
  network: string;
}

interface SettlementEvent {
  protocol: 'x402' | 'mpp';
  payer: string;
  transaction: string;
  network: string;
}

interface ResponseMeta {
  statusCode: number;
  statusText: string;
  duration: number;               // ms since startTime
  contentType: string | null;
  headers: Record<string, string>;
  body: string | null;            // response body
  requestBody: string | null;     // buffered request body (null for probes, GET, non-.body() routes)
}

interface ErrorEvent {
  status: number;
  message: string;
  settled: boolean;               // was payment already settled before error?
}

type AlertLevel = 'info' | 'warn' | 'error' | 'critical';

interface AlertEvent {
  level: AlertLevel;
  message: string;
  route: string;
  /** Arbitrary structured data — provider name, error codes, thresholds, etc. */
  meta?: Record<string, unknown>;
}
```

### `ctx.alert()` — handler-driven alerting

The handler context exposes `alert()`. The service decides **when** something is alert-worthy. The plugin decides **how** it's delivered. The router is just the pipe.

```typescript
export const POST = router.route('exa/search')
  .paid('0.01')
  .body(searchSchema)
  .handler(async ({ body, alert }) => {
    const result = await exaClient.search(body);

    if (result.rateLimit?.remaining < 100) {
      alert('warn', 'Exa rate limit low', {
        remaining: result.rateLimit.remaining,
        provider: 'exa',
      });
    }

    return result;
  });
```

**Signature on the handler context:**

```typescript
type AlertFn = (
  level: AlertLevel,
  message: string,
  meta?: Record<string, unknown>,
) => void;
```

Internally, the router constructs the full `AlertEvent` (adding `route` from the builder) and calls `plugin.onAlert(ctx, event)`. If no plugin or no `onAlert` — it's a no-op. Zero cost.

The router also fires `onAlert` itself for protocol-level events:
- Settlement failure after handler success → `critical`, "Payment settled but handler failed post-settlement"
- Payment verification failure with `settled: true` → `critical`, should never happen but defense in depth

### Where hooks fire in the orchestration

```
Request arrives
│
├─ 1. DETECT AUTH/PAYMENT
│     plugin.onRequest(meta)
│     └─ None → 402 fast exit
│        plugin.onResponse(ctx, { status: 402 })  ← still fires
│
├─ 2. BODY BUFFER + ZOD VALIDATE
│     → 400 on failure (no hook — fast exit)
│
├─ 3. AUTH/PAYMENT VERIFY
│     plugin.onPaymentVerified(ctx, payment)
│
├─ 4. HANDLER
│     handler receives { body, wallet, alert, ... }
│     handler may call alert('warn', '...', { ... })
│       → plugin.onAlert(ctx, alertEvent)
│
├─ 5. SETTLEMENT (if handler succeeded)
│     plugin.onPaymentSettled(ctx, settlement)
│     on failure → plugin.onAlert(ctx, { level: 'critical', ... })
│
├─ 6. RESPONSE
│     plugin.onResponse(ctx, responseMeta)       ← always fires
│
└─ ON ERROR (at any point)
      plugin.onError(ctx, error)
```

### DX: External developers (no private packages)

**Zero config — no observability, no noise:**

```typescript
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
});
```

Routes work. Payments work. Discovery works. `alert()` is a no-op. Done.

**Console plugin — for development and debugging:**

Ships with the router. Logs lifecycle events and alerts to `console.log` / `console.warn`.

```typescript
import { createRouter, consolePlugin } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: consolePlugin(),
});
```

Output looks like:
```
[router] POST exa/search → 200 (142ms) wallet=0xabc...
[router] WARN exa/search: Exa rate limit low {remaining: 42, provider: "exa"}
[router] SETTLED exa/search x402 tx=0xdef... (0.02 USDC)
```

**Custom plugin — bring your own backend:**

Any object satisfying `RouterPlugin`. Implement only the hooks you care about.

```typescript
import { createRouter, type RouterPlugin } from '@agentcash/router';

const datadogPlugin: RouterPlugin = {
  onResponse(ctx, res) {
    dd.increment('api.request', { route: ctx.route, status: res.statusCode });
  },
  onAlert(ctx, alert) {
    if (alert.level === 'critical') pagerduty.trigger(alert.message);
  },
};

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: datadogPlugin,
});
```

### DX: Merit team (private observability)

**One import, one line:**

```typescript
import { createRouter } from '@agentcash/router';
import { meritPlugin } from '@merit-internal/router-plugin';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
});
```

`meritPlugin()` reads env vars internally (`CLICKHOUSE_URL`, `DISCORD_WEBHOOK_URL`, etc.) and returns a `RouterPlugin` that:

| Hook | What it does |
|------|-------------|
| `init()` | Creates ClickHouse client singleton, optional health ping |
| `onRequest()` | Extracts identity headers, builds `PluginContext` with `setVerifiedWallet` mutator |
| `onPaymentVerified()` | Sets `verifiedWallet` on context |
| `onPaymentSettled()` | Logs settlement to ClickHouse |
| `onResponse()` | Fire-and-forget insert into `mcp_resource_invocations` table |
| `onError()` | Logs error row to ClickHouse |
| `onAlert()` | Routes to Discord webhook with per-provider dedup, level-based formatting |

The private package owns:
- ClickHouse client singleton + connection management
- `mcp_resource_invocations` table schema mapping
- Discord webhook delivery + per-provider dedup logic (Exa spend buckets, Whitepages count tracking, hash-based fallback)
- Verified wallet extraction from x402/SIWX payment headers
- All env var names and defaults

**What the open source code never sees:**
- No `@merit-*` or `@agentcash/telemetry-*` import in examples
- No ClickHouse table names or column schemas
- No Discord webhook logic or dedup algorithms
- No `TELEM_CLICKHOUSE_*` env var names

### Handler context (updated)

```typescript
type HandlerContext<TBody, TQuery> = {
  body: TBody;                        // parsed + validated (if .body())
  query: TQuery;                      // parsed + validated (if .query())
  request: NextRequest;               // raw request (escape hatch)
  wallet: string | null;              // verified wallet (x402, MPP, or SIWX)
  account?: unknown;                  // from .apiKey() resolver

  /** Fire an alert. Plugin decides delivery. No-op if no plugin. */
  alert: AlertFn;

  /** Set the verified wallet (for API-key routes or manual auth). */
  setVerifiedWallet: (address: string) => void;
};
```

`alert` delegates to the `PluginContext`'s plugin hooks — if no plugin is configured, `alert` is a no-op. `setVerifiedWallet` is NOT a no-op — it always works, even without a plugin, because it updates the router-owned context that feeds `wallet` to the handler. API-key routes depend on this.

### What stays private (summary)

| Concern | Where it lives | How the router connects |
|---------|---------------|------------------------|
| ClickHouse logging | Private `RouterPlugin` impl | `onResponse()`, `onError()` hooks |
| Discord alerting + dedup | Private `RouterPlugin` impl | `onAlert()` hook |
| Pricing maps & markup | Per-service config | `createRouter({ prices: ... })` or `.paid()` |
| Provider-specific alert rules | Private plugin internals | Dedup logic inside `onAlert()` |
| Operational hot wallet | Per-service handler code | Not router's concern |

### Updated package structure

```
@agentcash/router (public, open source)
├── src/
│   ├── index.ts              # createRouter(), consolePlugin(), re-exports
│   ├── builder.ts            # RouteBuilder class (fluent API)
│   ├── orchestrate.ts        # Request orchestration loop
│   ├── protocols/
│   │   ├── x402.ts           # x402 verify + settle
│   │   ├── mpp.ts            # MPP challenge + credential + receipt
│   │   └── detect.ts         # Header-based protocol detection
│   ├── auth/
│   │   ├── siwx.ts           # SIWX verify with nonce store
│   │   ├── api-key.ts        # API key lookup
│   │   └── nonce.ts          # NonceStore interface + MemoryNonceStore
│   ├── server.ts             # x402ResourceServer singleton + lifecycle
│   ├── registry.ts           # Route registry (discovery + OpenAPI)
│   ├── handler.ts            # safeCallHandler error boundary
│   ├── body.ts               # Body buffering + Zod validation
│   ├── discovery/
│   │   ├── well-known.ts     # Auto .well-known/x402 + .well-known/mpp
│   │   └── openapi.ts        # Auto OpenAPI 3.1 spec generation
│   ├── plugin.ts             # RouterPlugin interface + no-op default + consolePlugin
│   └── types.ts              # Shared types, HttpError, HandlerContext, AlertEvent

(private, Merit only — NOT in the open source repo)
├── src/
│   ├── index.ts              # meritPlugin() factory
│   ├── clickhouse.ts         # ClickHouse client singleton + insert
│   ├── discord.ts            # Discord webhook + per-provider dedup
│   ├── context.ts            # PluginContext with setVerifiedWallet
│   └── extract-wallet.ts     # Verified wallet extraction from headers
```

### Audit summary

| Item | In the router? | Resolution |
|------|---------------|------------|
| ClickHouse client + inserts | No | `RouterPlugin.onResponse()` |
| `mcp_resource_invocations` schema | No | Private plugin internals |
| Discord alerting + dedup | No | `RouterPlugin.onAlert()` |
| `PRICE_MARKUP`, `BASE_PRICES` | No | Caller-provided pricing config |
| `enrichx402.com` domain | No | Auto-detected from request |
| `@merit-systems/*` package ref | No | Private plugin, not in OSS code |
| `@clickhouse/client` dep | No | Only in private plugin |
| SIWX network defaults | Yes | Public blockchain values |
| x402 facilitator URL | Yes | Public protocol infrastructure |
| USDC contract address | Yes | Public on-chain address |

---

## Testing Plan

### Philosophy

Tests are living documentation. Every test file should read like a spec for the module it covers. If a test needs a paragraph comment to explain what it's checking, the test is wrong.

**Guiding principles:**

1. **No slop.** A test that passes when the code is broken is worse than no test. A test that mocks everything it calls is just testing the mocks. Delete both.
2. **Test the orchestration, not the libraries.** x402, mpay, and Zod are already tested. We test that we call them correctly, in the right order, with the right inputs.
3. **Fakes over mocks.** A `FakeX402Server` that accepts payments matching a known address and rejects everything else. Not `jest.fn().mockResolvedValue(...)` spread across 40 lines. Fakes have behavior. Mocks have return values.
4. **One assertion per concept.** A test named `'skips settlement when handler returns 500'` asserts exactly that. If you need to also check the response body, that's a second test.
5. **Test names are the spec.** Reading the test names top-to-bottom should tell you exactly what the module guarantees. If a behavior isn't in a test name, it isn't guaranteed.
6. **Edge cases over happy paths.** The happy path works because the orchestration is simple composition. The value is in: body stream consumed before handler, settlement skipped on throw, nonce replay rejected, dynamic price exceeding maxPrice.

### What we DON'T test

- Re-exports and type aliases
- That Zod validates correctly (it does)
- That `x402ResourceServer.verifyPayment` works (Coinbase tests that)
- That `mpay` signs credentials correctly
- Console output formatting from `consolePlugin`

### Fake infrastructure

Two fakes, shared across all test files:

```typescript
// test/fakes/x402-server.ts
// Accepts payments from KNOWN_PAYER to KNOWN_PAYEE for exact amounts.
// Rejects everything else. Returns deterministic tx hashes.
// Implements the same method signatures as x402ResourceServer.

// test/fakes/request.ts
// Builds NextRequest objects with payment headers, SIWX headers,
// MPP credentials, bodies, query params. One-liner per variant.
```

These are real objects with real logic, not mock scaffolding. A `FakeX402Server` that rejects underpayment is testing the same branch the real server would trigger — we're testing that the router handles the rejection correctly.

### Test structure

```
tests/
├── fakes/
│   ├── x402-server.ts          # Fake x402ResourceServer
│   ├── mpay-server.ts          # Fake mpay Tempo verifier
│   └── request.ts              # NextRequest builders
│
├── orchestrate.test.ts         # THE important tests
├── builder.test.ts             # Fluent API contracts
├── pricing.test.ts             # Price resolution
├── body.test.ts                # Body buffering edge cases
├── handler.test.ts             # safeCallHandler error boundary
├── nonce.test.ts               # MemoryNonceStore TTL + replay
├── detect.test.ts              # Protocol detection from headers
├── registry.test.ts            # Route registration + barrel validation
└── discovery.test.ts           # .well-known + OpenAPI output
```

### Test specs

#### `orchestrate.test.ts` — the core

This is the most important file. It constructs a real router with `FakeX402Server`, registers real routes, and sends real `NextRequest` objects through the compiled handler. No mocking the handler, no mocking the orchestration. The fakes sit at the protocol boundary only.

```
probe request (no auth header)
  ✓ returns 402 without reading body (stream untouched)
  ✓ returns 402 with Bazaar extensions describing input schema
  ✓ does not run Zod validation on probe
  ✓ uses maxPrice for dynamic pricing in 402 challenge
  ✓ uses highest tier price for tiered pricing in 402 challenge

x402 paid route
  ✓ returns 200 with settlement header on valid payment
  ✓ returns 402 on invalid payment (bad signature → verify fails)
  ✓ returns 402 on underpayment (amount < price)
  ✓ skips settlement when handler returns error status
  ✓ skips settlement when handler throws
  ✓ sets wallet on handler context from verified payer
  ✓ returns 400 on Zod validation failure (with payment header)

MPP paid route
  ✓ returns 402 with WWW-Authenticate header when no credential
  ✓ returns 200 with Payment-Receipt on valid credential
  ✓ returns 402 on invalid MPP credential

dual-protocol route
  ✓ returns both PAYMENT-REQUIRED and WWW-Authenticate on 402
  ✓ accepts x402 payment on dual-protocol route
  ✓ accepts MPP credential on dual-protocol route

SIWX route
  ✓ returns 402 challenge when no SIWX header
  ✓ returns 200 with wallet from verified signature
  ✓ rejects replayed nonce
  ✓ rejects expired SIWX message

unprotected route
  ✓ returns 200 with no auth required
  ✓ wallet is null on handler context

API key + paid route
  ✓ rejects missing API key before checking payment
  ✓ rejects invalid API key
  ✓ processes payment after valid API key
```

#### `builder.test.ts` — API contracts

Tests that the fluent API produces working handlers and rejects invalid chains. The compile-time tests use `@ts-expect-error` — they verify that TypeScript itself rejects the bad chains. If the `@ts-expect-error` stops being needed (i.e., the bad chain compiles), the test fails.

```
fluent chain
  ✓ .paid().body().handler() produces a function
  ✓ .siwx().query().handler() produces a function
  ✓ .unprotected().handler() produces a function
  ✓ .paid().body().output().description().handler() preserves all metadata in registry
  ✓ route key is stored in registry on construction

compile-time safety (@ts-expect-error)
  ✓ .handler() without auth method → type error
  ✓ .paid() after .siwx() → type error (double auth)
  ✓ .siwx() after .paid() → type error (double auth)
  ✓ .paid(fn).handler() without .body() → type error (dynamic pricing needs body)
  ✓ .paid({ field, tiers }).handler() without .body() → type error (tiered needs body)
  ✓ .paid(string).handler() without .body() → compiles (static pricing, body optional)

registration-time safety (throws on import)
  ✓ dynamic pricing without maxPrice throws at registration
  ✓ duplicate route key throws at registration
  ✓ empty tier key throws at registration
  ✓ maxPrice '0' throws at registration
  ✓ maxPrice 'abc' throws at registration
```

#### `pricing.test.ts` — price resolution

```
static pricing
  ✓ resolves string price as-is

dynamic pricing
  ✓ calls price function with parsed body
  ✓ uses maxPrice in 402 response
  ✓ rejects when computed price exceeds maxPrice (config error)
  ✓ settles for actual price when payment covers it

tiered pricing
  ✓ resolves tier from body field
  ✓ uses highest tier price in 402 response
  ✓ rejects unknown tier key with 400
  ✓ uses default tier when field missing (if configured)
```

#### `body.test.ts` — body buffering

```
with .body() schema
  ✓ handler receives parsed + validated Zod output
  ✓ dynamic price function receives same parsed body
  ✓ invalid JSON → 400 before payment check
  ✓ Zod validation failure → 400 with formatted issues

without .body() schema
  ✓ handler receives body: undefined
  ✓ handler can call request.formData() (stream intact)
  ✓ handler can call request.arrayBuffer() (stream intact)
  ✓ plugin RequestMeta.body is null
```

#### `handler.test.ts` — error boundary

```
safeCallHandler
  ✓ plain object → NextResponse.json(result)
  ✓ NextResponse passthrough unchanged
  ✓ thrown Error → 500 with error message
  ✓ thrown HttpError(504) → 504 with message
  ✓ thrown non-Error → 500 with 'Internal error'
```

#### `nonce.test.ts` — replay protection

```
MemoryNonceStore
  ✓ first use of nonce returns true
  ✓ second use of same nonce returns false
  ✓ nonce accepted again after TTL expires
  ✓ evicts expired entries on check
```

#### `detect.test.ts` — protocol detection

```
detectProtocol
  ✓ PAYMENT-SIGNATURE header → 'x402'
  ✓ X-PAYMENT header → 'x402'
  ✓ Authorization with MPP credential → 'mpp'
  ✓ SIGN-IN-WITH-X header → 'siwx'
  ✓ no recognized header → null
  ✓ multiple headers → first match in priority order (x402 > mpp > siwx)
```

#### `registry.test.ts` — route registration

```
route registration
  ✓ router.route() adds entry to registry
  ✓ registry entry contains price, schemas, description, protocols
  ✓ duplicate route key throws at registration

barrel validation (prices map)
  ✓ passes when all prices keys have registered routes
  ✓ throws naming the missing route key when barrel import is missing
  ✓ SIWX and unprotected routes not in prices map → no error
  ✓ route registered but not in prices map → no error (price set inline via .paid())
```

#### `discovery.test.ts` — generated output

```
.well-known/x402
  ✓ lists all routes with x402 in protocols
  ✓ excludes SIWX-only and unprotected routes
  ✓ includes Bazaar extensions from .body() and .output() schemas

.well-known/mpp
  ✓ lists all routes with mpp in protocols
  ✓ empty when no routes declare mpp

OpenAPI
  ✓ generates valid OpenAPI 3.1 spec
  ✓ includes x-payment-info with price and protocols
  ✓ request body schema matches .body() Zod schema
  ✓ response schema matches .output() Zod schema
  ✓ includes route description
```

#### `plugin.test.ts` — lifecycle hooks

Uses a spy plugin (plain object with `jest.fn()` methods) to verify hooks fire at the right time. This is the one place mocks are appropriate — we're testing "did the router call this hook?" not "does the hook work?"

```
plugin lifecycle
  ✓ onRequest fires before auth check
  ✓ onPaymentVerified fires after successful verify
  ✓ onPaymentSettled fires after successful settlement
  ✓ onResponse fires on every request (success and error)
  ✓ onError fires when handler throws
  ✓ onAlert fires when handler calls ctx.alert()
  ✓ onAlert fires on settlement failure
  ✓ plugin not configured → no errors, hooks silently skipped

PluginContext
  ✓ setVerifiedWallet updates handler context wallet
  ✓ context created even without plugin
```

### Runner

Vitest. Fast, native ESM, good TypeScript support. No Jest config ceremony.
