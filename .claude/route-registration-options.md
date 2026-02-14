# Route Registration: Three Approaches

Same routes, three ways. Compare the DX.

Routes used:
- `exa/search` — static price, POST, body + output schema
- `apollo/people-search` — static price, POST, body + output schema
- `google-maps/text-search/full` — static price, GET, query + output schema
- `generate` (stablestudio) — dynamic price, POST, body + output schema, SIWX job list

---

## Approach A: Manifest + Handlers

Central manifest declares every route's metadata. Handler files reference manifest keys.
OpenAPI reads the manifest — no imports needed.

```
Who declares what:
  lib/routes.ts        → route existence, price, method, path, description
  app/api/.../route.ts → Zod schemas, handler logic
```

### lib/routes.ts

```typescript
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
  routes: {
    'exa/search':                 { price: '0.02', method: 'POST', description: 'Neural web search' },
    'apollo/people-search':       { price: '0.02', method: 'POST', description: 'Search for people by name, title, company' },
    'google-maps/text-search/full': { price: '0.08', method: 'GET', description: 'Google Maps text search with full details' },
  },
});
```

### app/api/exa/search/route.ts

```typescript
import { router } from '@/lib/routes';
import { searchRequestSchema, searchResponseSchema } from './schemas';
import { search } from './handler';

export const POST = router.route('exa/search')     // ← type-checked against manifest keys
  .body(searchRequestSchema)
  .output(searchResponseSchema)
  .handler(async ({ body }) => search(body));
```

### app/api/apollo/people-search/route.ts

```typescript
import { router } from '@/lib/routes';
import { peopleSearchSchema, peopleSearchResponseSchema } from './schemas';
import { searchPeople } from './handler';

export const POST = router.route('apollo/people-search')
  .body(peopleSearchSchema)
  .output(peopleSearchResponseSchema)
  .handler(async ({ body }) => searchPeople(body));
```

### app/api/google-maps/text-search/full/route.ts

```typescript
import { router } from '@/lib/routes';
import { textSearchQuerySchema, textSearchResponseSchema } from './schemas';
import { textSearchFull } from './handler';

export const GET = router.route('google-maps/text-search/full')
  .query(textSearchQuerySchema)
  .output(textSearchResponseSchema)
  .handler(async ({ query }) => textSearchFull(query));
```

### stablestudio: lib/routes.ts

```typescript
export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
  routes: {
    'generate':  { maxPrice: '5.00', method: 'POST', description: 'Generate image/video' },
    'jobs':      { method: 'GET', auth: 'siwx', description: 'List jobs' },
  },
});
```

### stablestudio: app/api/x402/[model]/[operation]/route.ts

```typescript
import { router } from '@/lib/routes';
import { jobSettingsSchema, jobResponseSchema } from '@/lib/schemas';
import { calculateJobCost, createJob, startWorkflow, ensureUser } from '@/lib/jobs';

export const POST = router.route('generate')
  .paid((body) => calculateJobCost(body).toFixed(6))
  .body(jobSettingsSchema)
  .output(jobResponseSchema)
  .handler(async ({ body, wallet }) => {
    const user = await ensureUser(wallet);
    const job = await createJob(body, user);
    await startWorkflow(job);
    return { jobId: job.id, status: 'pending' };
  });
```

### stablestudio: app/api/x402/jobs/route.ts

```typescript
import { router } from '@/lib/routes';
import { jobListSchema } from '@/lib/schemas';
import { listJobs } from '@/lib/jobs';

export const GET = router.route('jobs')
  .siwx()
  .output(jobListSchema)
  .handler(async ({ wallet }) => listJobs(wallet));
```

### OpenAPI + discovery (both services)

```typescript
// app/openapi.json/route.ts
import { router } from '@/lib/routes';
// No route imports needed — manifest has everything for the endpoint index.
// Zod schemas for Bazaar detail are unavailable here (they live in handler files).
// OpenAPI shows paths + prices + descriptions but NOT full request/response schemas.
export const GET = router.openapi({ title: 'enrichx402 API', version: '1.0.0' });

// app/.well-known/x402/route.ts
import { router } from '@/lib/routes';
export const GET = router.wellKnown();
```

### Analysis

**Pros:**
- Route existence is declared once centrally — impossible to forget a route
- `router.route('typo')` is a type error (key must exist in manifest)
- OpenAPI endpoint needs zero route imports
- Price is visible at a glance in one file
- Discovery (`.well-known`) works with just the manifest

**Cons:**
- Route metadata split across two files (manifest has price/description, handler has schemas)
- OpenAPI spec can show paths and prices but NOT request/response schemas unless handler files are also imported
- Adding a route requires editing two files (manifest + handler)
- The manifest duplicates what `.paid('0.02')` already expresses — you'd call `.paid()` without a price arg if using manifest pricing, which is a different API shape

**Verdict:** Clean for discovery and existence checking. Awkward for full OpenAPI with schemas. The "two places" problem is real — you'd still need barrel imports for full schema richness in the OpenAPI spec.

---

## Approach B: Self-Registering Routes + Validated Barrel

Routes self-register. One barrel file imports them all. Router validates completeness.
This is what enrichx402 does today, but with guardrails.

```
Who declares what:
  app/api/.../route.ts → everything (price, schemas, handler)
  lib/routes/barrel.ts → just imports (no logic, no metadata)
```

### lib/routes.ts

```typescript
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
});
```

### app/api/exa/search/route.ts

```typescript
import { router } from '@/lib/routes';
import { searchRequestSchema, searchResponseSchema } from './schemas';
import { search } from './handler';

export const POST = router.route('exa/search')
  .paid('0.02')
  .body(searchRequestSchema)
  .output(searchResponseSchema)
  .description('Neural web search')
  .handler(async ({ body }) => search(body));
```

### app/api/apollo/people-search/route.ts

```typescript
import { router } from '@/lib/routes';
import { peopleSearchSchema, peopleSearchResponseSchema } from './schemas';
import { searchPeople } from './handler';

export const POST = router.route('apollo/people-search')
  .paid('0.02')
  .body(peopleSearchSchema)
  .output(peopleSearchResponseSchema)
  .description('Search for people by name, title, company')
  .handler(async ({ body }) => searchPeople(body));
```

### app/api/google-maps/text-search/full/route.ts

```typescript
import { router } from '@/lib/routes';
import { textSearchQuerySchema, textSearchResponseSchema } from './schemas';
import { textSearchFull } from './handler';

export const GET = router.route('google-maps/text-search/full')
  .paid('0.08')
  .query(textSearchQuerySchema)
  .output(textSearchResponseSchema)
  .description('Google Maps text search with full details')
  .handler(async ({ query }) => textSearchFull(query));
```

### lib/routes/barrel.ts (the one file you maintain)

```typescript
// Every paid/siwx route must be imported here for OpenAPI + discovery.
// The router validates this list is complete at startup.
import '@/app/api/exa/search/route';
import '@/app/api/apollo/people-search/route';
import '@/app/api/google-maps/text-search/full/route';
```

### OpenAPI + discovery

```typescript
// app/openapi.json/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/barrel';  // ← triggers all registrations

export const GET = router.openapi({ title: 'enrichx402 API', version: '1.0.0' });

// app/.well-known/x402/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/barrel';

export const GET = router.wellKnown();
```

### Completeness validation

The router can't know what routes SHOULD exist without being told. Two options:

**Option 1: Price map as the source of truth.**
```typescript
// lib/routes.ts
export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  prices: {
    'exa/search': '0.02',
    'apollo/people-search': '0.02',
    'google-maps/text-search/full': '0.08',
  },
});

// On first openapi/wellKnown request, router checks:
// "prices has 3 keys, registry has 3 entries — all good"
// If registry is missing 'apollo/people-search' → throw:
//   "Route 'apollo/people-search' is in prices but not registered.
//    Did you forget to import it in lib/routes/barrel.ts?"
```

**Option 2: Explicit expected list.**
```typescript
export const GET = router.openapi({
  title: 'enrichx402 API',
  version: '1.0.0',
  expect: ['exa/search', 'apollo/people-search', 'google-maps/text-search/full'],
  // throws if any expected route is not in the registry
});
```

### stablestudio variant

```typescript
// lib/routes.ts
export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
});

// app/api/x402/[model]/[operation]/route.ts
export const POST = router.route('generate')
  .paid((body) => calculateJobCost(body).toFixed(6), { maxPrice: '5.00' })
  .body(jobSettingsSchema)
  .output(jobResponseSchema)
  .description('Generate image/video')
  .handler(async ({ body, wallet }) => {
    const user = await ensureUser(wallet);
    const job = await createJob(body, user);
    await startWorkflow(job);
    return { jobId: job.id, status: 'pending' };
  });

// app/api/x402/jobs/route.ts
export const GET = router.route('jobs')
  .siwx()
  .output(jobListSchema)
  .description('List jobs')
  .handler(async ({ wallet }) => listJobs(wallet));

// lib/routes/barrel.ts
import '@/app/api/x402/[model]/[operation]/route';
import '@/app/api/x402/jobs/route';
```

### Analysis

**Pros:**
- Route defined in exactly ONE place — the handler file has everything
- OpenAPI gets full Zod schemas (body, output, query) because the handler module executes
- Handler file is the single source of truth — what you see is what you get
- The barrel file is braindead simple — just imports, no logic
- Completeness validation catches missing imports at startup

**Cons:**
- Must maintain a barrel file (but it's just import lines)
- Side-effect imports are unfamiliar / feel magical to some
- If you forget to add to the barrel AND don't use the price map validation, the route silently vanishes from OpenAPI
- Two files import the barrel (openapi + well-known) — minor duplication

**Verdict:** Simplest handler DX. The barrel is annoying but small. Validation via price map makes it fail-loud.

---

## Approach C: Central Route Definitions, One-Line Re-exports

All routes defined in central files (grouped by domain). Next.js route files are one-line re-exports.
Router sees everything because all routes are in modules it imports.

```
Who declares what:
  lib/routes/*.ts      → everything (price, schemas, handler)
  app/api/.../route.ts → just re-exports the handler
```

### lib/routes/index.ts

```typescript
import { createRouter } from '@agentcash/router';

export const router = createRouter({
  payeeAddress: process.env.X402_PAYEE_ADDRESS!,
  plugin: meritPlugin(),
});
```

### lib/routes/exa.ts

```typescript
import { router } from './index';
import { searchRequestSchema, searchResponseSchema } from '@/lib/schemas/exa';
import { search } from '@/lib/handlers/exa';

export const exaSearch = router.route('exa/search')
  .paid('0.02')
  .body(searchRequestSchema)
  .output(searchResponseSchema)
  .description('Neural web search')
  .handler(async ({ body }) => search(body));
```

### lib/routes/apollo.ts

```typescript
import { router } from './index';
import { peopleSearchSchema, peopleSearchResponseSchema } from '@/lib/schemas/apollo';
import { searchPeople } from '@/lib/handlers/apollo';

export const apolloPeopleSearch = router.route('apollo/people-search')
  .paid('0.02')
  .body(peopleSearchSchema)
  .output(peopleSearchResponseSchema)
  .description('Search for people by name, title, company')
  .handler(async ({ body }) => searchPeople(body));
```

### lib/routes/google-maps.ts

```typescript
import { router } from './index';
import { textSearchQuerySchema, textSearchResponseSchema } from '@/lib/schemas/google-maps';
import { textSearchFull } from '@/lib/handlers/google-maps';

export const googleMapsTextSearchFull = router.route('google-maps/text-search/full')
  .paid('0.08')
  .query(textSearchQuerySchema)
  .output(textSearchResponseSchema)
  .description('Google Maps text search with full details')
  .handler(async ({ query }) => textSearchFull(query));
```

### lib/routes/all.ts (barrel — but of route definitions, not side effects)

```typescript
// Central barrel that imports all route modules.
// This is the ONLY file OpenAPI/discovery needs.
export { exaSearch } from './exa';
export { apolloPeopleSearch } from './apollo';
export { googleMapsTextSearchFull } from './google-maps';
```

### Next.js route files (one-liners)

```typescript
// app/api/exa/search/route.ts
export { exaSearch as POST } from '@/lib/routes/exa';

// app/api/apollo/people-search/route.ts
export { apolloPeopleSearch as POST } from '@/lib/routes/apollo';

// app/api/google-maps/text-search/full/route.ts
export { googleMapsTextSearchFull as GET } from '@/lib/routes/google-maps';
```

### OpenAPI + discovery

```typescript
// app/openapi.json/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/all';  // triggers all registrations via named exports

export const GET = router.openapi({ title: 'enrichx402 API', version: '1.0.0' });

// app/.well-known/x402/route.ts
import { router } from '@/lib/routes';
import '@/lib/routes/all';

export const GET = router.wellKnown();
```

### stablestudio variant

```typescript
// lib/routes/generate.ts
import { router } from './index';
import { jobSettingsSchema, jobResponseSchema } from '@/lib/schemas/jobs';
import { calculateJobCost, createJob, startWorkflow, ensureUser } from '@/lib/handlers/jobs';

export const generate = router.route('generate')
  .paid((body) => calculateJobCost(body).toFixed(6), { maxPrice: '5.00' })
  .body(jobSettingsSchema)
  .output(jobResponseSchema)
  .description('Generate image/video')
  .handler(async ({ body, wallet }) => {
    const user = await ensureUser(wallet);
    const job = await createJob(body, user);
    await startWorkflow(job);
    return { jobId: job.id, status: 'pending' };
  });

export const jobsList = router.route('jobs')
  .siwx()
  .output(jobListSchema)
  .description('List jobs')
  .handler(async ({ wallet }) => listJobs(wallet));

// app/api/x402/[model]/[operation]/route.ts
export { generate as POST } from '@/lib/routes/generate';

// app/api/x402/jobs/route.ts
export { jobsList as GET } from '@/lib/routes/generate';
```

### Analysis

**Pros:**
- Next.js route files are one-liners — absolute minimum boilerplate at the filesystem layer
- Route definition and handler live together in `lib/routes/*.ts`
- Named exports (not side-effect imports) — feels normal, IDE auto-completes
- OpenAPI gets full schemas because the route modules execute
- Easy to grep — all route definitions are in `lib/routes/`

**Cons:**
- Splits the codebase into two layers: `lib/routes/` (definitions) and `app/api/` (filesystem routing)
- Handler logic moves away from `app/api/` — developers must know to look in `lib/routes/`
- Co-located files (schemas, types, tests next to the route) become awkward — do they go next to `lib/routes/exa.ts` or `app/api/exa/search/`?
- Still need a barrel file (`lib/routes/all.ts`)
- Bundling risk: importing `lib/routes/exa.ts` pulls in `@/lib/handlers/exa` and all its deps. The Next.js route file for exa/search gets exactly what it needs, but the OpenAPI route file (which imports `all.ts`) bundles EVERY handler's dependencies. Could hurt cold start on the openapi endpoint.
- For enrichx402 with 27+ routes, the one-liner route files feel like boilerplate of a different kind — 27 files that each say one thing

**Verdict:** Cleanest route files, but moves complexity to a parallel directory structure. The "where does the code live" question gets murkier. Better for small services (3-6 routes) than large ones (27+).

---

## Comparison

| | A: Manifest | B: Self-Register + Barrel | C: Central Defs + Re-export |
|---|---|---|---|
| **Route defined in** | 2 places (manifest + handler) | 1 place (handler file) | 1 place (lib/routes/*.ts) |
| **Next.js route file** | 5-6 lines (full builder chain) | 5-6 lines (full builder chain) | 1 line (re-export) |
| **Barrel/manifest** | Manifest in createRouter | Import list in barrel.ts | Named export list in all.ts |
| **OpenAPI completeness** | Paths + prices only (no schemas) | Full (schemas included) | Full (schemas included) |
| **Fail-loud on missing route** | Yes (type error on route key) | Yes (price map validation) | No (easy to forget re-export) |
| **Where is handler logic?** | app/api/ (natural) | app/api/ (natural) | lib/routes/ (unfamiliar) |
| **Co-located schemas/tests** | Natural (next to handler) | Natural (next to handler) | Awkward (split from route file) |
| **Adding a new route** | Edit manifest + create handler | Create handler + add to barrel | Create lib/routes/x.ts + create route.ts + add to all.ts |
| **Scales to 27+ routes** | Clean manifest, clean handlers | Clean handlers, boring barrel | 27 one-liner files + 27 lib files |
