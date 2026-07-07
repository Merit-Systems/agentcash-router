/**
 * Next.js App Router adapter for `@agentcash/router`.
 *
 * Next.js accepts standard `(request: Request) => Promise<Response>` handlers,
 * so this adapter needs no `next` imports — it just fans every method out to
 * `router.fetch()` (the internal Hono app).
 */

interface FetchRouter {
  fetch(request: Request): Promise<Response>;
}

export interface NextRouteHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
}

/**
 * Build Next.js route handlers that delegate every request to the router.
 *
 * Use a single optional catch-all route so one file serves every registered
 * route. The module that registers your routes MUST be imported first —
 * otherwise the registry is empty and requests 404:
 *
 * ```ts
 * // app/api/[[...route]]/route.ts
 * import '@/server/routes'; // side-effect import: registers all routes
 * import { router } from '@/server/router';
 * import { nextHandlers } from '@agentcash/router/next';
 *
 * export const { GET, POST, PUT, PATCH, DELETE } = nextHandlers(router);
 * ```
 *
 * The catch-all only covers `/{basePath}/*` (default `/api/*`). The root
 * discovery surfaces — `/.well-known/x402` and `/llms.txt` — need one of:
 *
 * 1. Their own route files (no catch-all involvement):
 *    ```ts
 *    // app/.well-known/x402/route.ts
 *    export const GET = router.wellKnown();
 *    // app/llms.txt/route.ts
 *    export const GET = router.llmsTxt();
 *    ```
 * 2. A top-level middleware rewrite into the catch-all — the router also
 *    serves discovery under the basePath for exactly this:
 *    ```ts
 *    // middleware.ts
 *    export function middleware(request: NextRequest) {
 *      const { pathname } = request.nextUrl;
 *      if (pathname === '/.well-known/x402' || pathname === '/llms.txt') {
 *        return NextResponse.rewrite(new URL(`/api${pathname}`, request.url));
 *      }
 *    }
 *    ```
 *
 * `/openapi.json` is already served at `/{basePath}/openapi.json` through the
 * catch-all; the root alias needs the same treatment as above if you want it.
 */
export function nextHandlers(router: FetchRouter): NextRouteHandlers {
  const handle = (request: Request): Promise<Response> => router.fetch(request);
  return { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}
