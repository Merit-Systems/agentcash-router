---
'@agentcash/router': minor
---

Framework-agnostic core: the router now speaks Web-standard `Request`/`Response` and dispatches through an embedded Hono app. `next` is no longer a peer dependency (peers are just `zod`).

**Heads-up for TypeScript consumers:** handler and discovery signatures are now typed against Web-standard `Request`/`Response` instead of `NextRequest`/`NextResponse`, and `next` is no longer a peer dependency. Runtime behavior in Next.js apps is unchanged (Next accepts standard fetch handlers), but handler code that uses NextRequest-only APIs (`request.nextUrl`, `request.cookies`) needs a cast — or better, `new URL(request.url)` / the new `ctx.params`.

**New:**

- `router.fetch(request)` — standard fetch handler serving all registered routes at `/{basePath}/{path}` plus discovery surfaces; unmatched paths get the `notFound()` envelope.
- `router.hono()` — the internal Hono app, mountable into a larger app.
- `@agentcash/router/next` subpath — `nextHandlers(router)` for one-file Next.js catch-all hosting (`app/api/[[...route]]/route.ts`), replacing per-route files and the discovery barrel.
- `{param}` path templates with `ctx.params`, extracted identically in catch-all and per-file modes.
- `RouterConfig.basePath` (default `'api'`) — controls the mounted and advertised URL prefix.
- `.path()` values are normalized like `.route()` paths (leading slashes / `api/` prefix stripped), so a leading slash no longer produces a `//` URL in discovery.

Per-file Next.js hosting (`export const POST = router.route(...)...handler(...)`) is unchanged.
