---
'@agentcash/router': major
---

Router 2.0: framework-agnostic core, Hono + Next.js out of the box, and `.nextStep()` route chaining.

**Breaking changes**

- `next` is no longer a peer dependency. All public types use Web-standard `Request`/`Response` instead of `NextRequest`/`NextResponse` (`HandlerContext.request`, settlement lifecycle contexts, discovery handlers). Per-file Next.js usage (`export const POST = router.route(...)...handler(...)`) continues to work unchanged — Next.js accepts standard fetch handlers.
- `createRouter` now throws a single `RouterConfigError` carrying every config issue at once (previously up to three staged throws). `RouterConfigIssue.severity` / `RouterConfigIssueSeverity` removed (was never populated).
- `routerConfigFromEnv` is now the single env reader: when you pass `options.env`, KV credentials and CDP keys in it are honored (previously silently read from `process.env`).
- `multiplyDecimal` semantics: `mpp.session.depositMultiplier` must be a positive integer (validated at construction with a structured issue instead of crashing on first challenge).

**New**

- Hosting: internal Hono dispatch. `router.fetch(request)` and `router.hono()` for Hono/Bun/Node/Deno; new `@agentcash/router/next` subpath with `nextHandlers(router)` for a single Next.js catch-all route (`app/api/[[...route]]/route.ts`) — eliminates the discovery-stub/barrel workaround. `RouterConfig.basePath` (default `'api'`).
- Path templates: `{param}` segments in route paths are extracted into `ctx.params` in both hosting modes.
- `.nextStep({ route, args?, when?, note?, retryAfterSeconds? })`: declare a route's successor(s) at definition time. Successful JSON responses gain a structured `next` array (resolved URL, method, auth mode, price, note) so agents deterministically know what to call next and what it costs. The response body is the single chaining channel (no static `x-next`/`links`/`workflows` copies — they'd always be staler than the live one); an auto-generated `## Workflows` map summary rides the guidance channel into llms.txt AND OpenAPI `info.x-guidance`, and OpenAPI output schemas are extended with the optional `next` key. `registry.validate()` asserts route targets exist.
- `.nextStep({ external })`: external successors — the next call is a third-party request resolved from the result (e.g. a presigned-S3 PUT URL), not a registry route. Advertised as `{ external: true, method, url, headers?, body? }` with no `auth`/`price`; returning `null`/`undefined` skips the entry; exceptions warn and skip, never breaking the response. Exactly one of `route`/`external` per step.
- `retryAfterSeconds` on both step forms: a positive polling-cadence hint, validated at registration, emitted verbatim on `next` entries, and rendered in the workflows map (`retry ~Ns`).
- Route-form `args()` now receives the original request context as a second argument (`{ body, query, params }`), so a chain can reuse caller-sent values the result doesn't echo (e.g. a status route polling itself with the caller's token).
- The workflows map dedupes isomorphic chains (identical step sequences whose URLs differ only at the root) into one representative annotated `(and N similar routes)`, bounded at 12 distinct groups with an `…and N more workflows` summary line.
- `.docs(text)`: unbounded long-form route documentation, emitted ONLY as the OpenAPI operation `description`. `.description()` stays the one-sentence summary feeding the 402 challenge (≤400 chars on paid x402 routes), OpenAPI `summary`, and discovery one-liners; `.docs()` never reaches the 402 challenge, well-known, or llms.txt.
- `.settlement()` contexts: `ctx.result` is typed from `.output()`.
- Function-form `payTo` receives the accept's `network` as a third argument.

**Fixes & hardening**

- x402 settle retry now retries thrown transient errors (timeouts/network) and fails fast on deterministic failures; possible double-settle ambiguity is reported for reconciliation.
- Settlement uses server-built payment requirements; only Solana facilitator-enriched `extra` is taken from the client payload.
- Facilitator `/accepts` enrichment matched by `(scheme, network)` instead of array position.
- Upstash KV `update()` is now an atomic compare-and-set (Lua EVAL, TTL-preserving) — required by the mppx channel-state contract; the atomicity requirement is documented on `KvStore`.
- `protocols: ['mpp']` without MPP env vars now yields structured `missing_mpp_*` issues instead of a TypeError.
- In-process facilitator `getSupported` memo now honors its TTL (matters for long-running servers).
- Tiered pricing tier lookup no longer reads the prototype chain (`tier: "constructor"` → 400).
- Production warning when no KV store is configured now fires for programmatic `createRouter` too.
- Pipeline consolidation: static/dynamic paid flows share one prologue; ~20 step micro-files collapsed into five modules; dead code removed.
