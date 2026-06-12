# Router 2.0 Refactor Plan

Working doc for the open-sourcing refactor. Three workstreams: (A) Web-standard core +
Hono/Next.js adapters, (B) next-step chaining primitive, (C) taste cleanup.

## User-stated constraints (guardrails — do not break without asking)

- Core moves to Hono; Next.js supported out of the box via a wrapper. Both first-class.
- The chaining primitive must be **deterministic at route definition time**, structured,
  and **very simple** — its job is to make multi-step flows (submit → poll → download)
  obvious to agent callers without relying on prose guidance.
- Preserve existing guiding principles in AGENTS.md: route definition is 3–6 lines;
  registry is single source of truth; plugin interface is the observability boundary
  (no Merit-specific code in OSS); compose with @x402/*, mppx — don't reimplement.
- The user reviews one final PR; ship as a major version (2.0.0 changeset).

## Evidence base

- Full read of src spine (index, builder, types, pipeline, discovery, plugin, docs).
- the-stables usage report: 45 Next.js services, all file-per-route + barrel; chains are
  conveyed by prose only; pain points: no path params, untyped settlement ctx.result,
  discovery stubs, `Object.assign(new Error, {status})` instead of HttpError.
- Only ONE genuinely Next-specific API in the codebase: `request.nextUrl` in
  pipeline/steps/parse-query.ts. Everything else NextRequest/NextResponse-as-types.

## A. Web-standard core + adapters

1. Replace all `next/server` imports with Web standards. `NextResponse.json` →
   `Response.json`, `request.nextUrl.searchParams` → `new URL(request.url).searchParams`.
   Internal handler type becomes `(request: Request) => Promise<Response>`.
   Drop `next` from peerDependencies; add `hono` as a dependency (tiny, zero-dep).
2. `createRouter()` builds an internal Hono app:
   - All registered routes mount at `/{basePath}/{path}` (basePath default `api`,
     configurable). Path templates `{param}` convert to Hono `:param`; `ctx.params`
     (typed `Record<string, string>`) added to HandlerContext.
   - Discovery auto-mounted: `/.well-known/x402`, `/{basePath}/openapi.json` + root
     `/openapi.json`, `/llms.txt`.
   - `router.fetch(request)` standard fetch handler; `router.hono()` returns the Hono
     app for mounting into a larger app (`app.route('/', router.hono())`).
3. `@agentcash/router/next` subpath export: `nextHandlers(router)` →
   `{ GET, POST, PUT, PATCH, DELETE }` for a single catch-all
   `app/api/[[...route]]/route.ts`. This kills the discovery-stub workaround (one
   routes module imported by the catch-all = registry always fully populated).
4. **Back-compat**: `.handler()` continues to return a standalone fetch handler usable
   as `export const POST = ...` in per-file Next routes (Next accepts plain Request
   handlers). Per-file routes with `{param}` segments get params extracted by matching
   the route's own template against the URL.
5. tsup: multi-entry build (`index`, `next`, `hono` if needed) with exports map.

## B. Next-step chaining primitive: `.nextStep()`

Builder method, repeatable (multiple successors allowed):

```ts
router.route({ path: 'generate/seedance/t2v' })
  .paid(priceFn).body(schema).output(jobSchema)
  .nextStep({
    route: 'jobs/{jobId}',                       // target route key — validated against registry
    args: (result) => ({ jobId: result.jobId }), // typed from TOutput; fills path/query params
    when: (result) => true,                      // optional runtime predicate, default always
    note: 'Poll every ~5s until status is "complete".',
  })
  .handler(...)
```

Runtime: when the handler succeeds (2xx) and returns a plain JSON object, the router
appends a reserved `next` array to the response body:

```json
{ "...result": "...",
  "next": [{ "method": "GET", "url": "https://host/api/jobs/abc", "auth": "siwx",
             "price": "0.00", "note": "Poll every ~5s until status is \"complete\"." }] }
```

- Fully resolved URL (args applied to the target's path template / query).
- `auth` + `price` derived from the target RouteEntry — the agent knows whether the
  next call costs money before making it.
- Never overrides a handler-supplied `next` key; skipped for streams/raw Responses.
- Target validation happens at the same moment as barrel validation (registry walk in
  discovery handlers + `registry.validate`), since module load order is non-deterministic.

Discovery surfaces:
- OpenAPI: native `links` objects on the 200 response pointing at the target operationId.
- well-known + llms.txt: auto-render a "Workflows" section from the nextStep graph
  (chains derived by walking edges), replacing today's hand-written prose flows.

## C. Cleanup (high-leverage)

1. Merge static/dynamic paid flows: shared `resolvePaidRequest` prologue (api-key gate →
   pricing → strategy → early body → SIWX fast path → challenge → body+price → verify →
   fire events), with billing-mode-specific invoke + settle tails. Deletes
   `*-body-and-price.ts` duplication and the triplicated verify→challenge sequence.
2. Collapse `pipeline/steps/` 20 micro-files into ~4 cohesive modules
   (context.ts, body.ts, settle.ts, finalize.ts) without changing behavior.
3. Dead code: `createRouter`'s x402ConfigError/mppConfigError dead path (verify via
   config review agent), `pipeline/handler.ts` safeCallHandler (duplicates
   static-invoke logic — check usage), registry.get linear fallback.
4. Settlement lifecycle ctx typing: `SettlementLifecycle<TBody, TResult>` with TResult
   from `.output()`.
5. Apply review-agent findings (protocols, config/kv/auth/pricing) judged worth it.
6. README/AGENTS.md rewrite for the new architecture; update examples/ (fortune,
   vercel-deploy) to catch-all pattern; add hono example.
7. Changeset: major.

## Explicit non-goals

- No filesystem route auto-scanning (stables report suggested it; rejected — magic,
  framework-specific, and the catch-all pattern solves the same problem simply).
- No role/scope auth model, no new payment protocols, no telemetry changes.
- Don't rename builder verbs (.paid/.upTo/.metered/.siwx/.apiKey/.unprotected stay).
