/**
 * Request-context construction and error introspection helpers — the first
 * step of every flow. `preflight` builds the per-request `FlowCtx` (plugin
 * context, reporter, path params); the `error*` helpers read `.status` /
 * `.message` off arbitrary thrown values (AGENTS.md: respect `.status` on any
 * thrown error, not just `HttpError`).
 */
import type { HandlerContext, RouteEntry } from '../../types.js';
import type { RouteHandler } from '../orchestrate.js';
import { HEADERS } from '../../headers.js';
import type { PluginContext, RequestMeta } from '../../plugin/index.js';
import { createDefaultContext, firePluginHook } from '../../plugin/index.js';
import { createReporter } from '../../plugin/reporter.js';
import { matchPathParams } from '../../path-params.js';
import type { FlowCtx, RouteRouting, RouterDeps } from './types.js';

export function preflight(
  routeEntry: RouteEntry,
  handler: RouteHandler,
  deps: RouterDeps,
  request: Request,
  routing: RouteRouting | null = null,
): FlowCtx {
  const meta = buildMeta(request, routeEntry);
  const pluginCtx =
    (firePluginHook(deps.plugin, 'onRequest', meta) as PluginContext | undefined) ??
    createDefaultContext(meta);

  return {
    routeEntry,
    handler: handler as (ctx: HandlerContext) => Promise<unknown> | AsyncIterable<unknown>,
    deps,
    request,
    meta,
    pluginCtx,
    report: createReporter(deps.plugin, pluginCtx, routeEntry.key),
    query: undefined,
    params: matchPathParams(routeEntry.path ?? routeEntry.key, new URL(request.url).pathname),
    routing,
  };
}

function buildMeta(request: Request, routeEntry: RouteEntry): RequestMeta {
  return {
    requestId: crypto.randomUUID(),
    method: request.method,
    route: routeEntry.key,
    origin: request.headers.get('origin') ?? new URL(request.url).origin,
    referer: request.headers.get('referer'),
    walletAddress: request.headers.get(HEADERS.WALLET_ADDRESS),
    clientId: request.headers.get(HEADERS.CLIENT_ID),
    sessionId: request.headers.get(HEADERS.SESSION_ID),
    contentType: request.headers.get('content-type'),
    headers: Object.fromEntries(request.headers.entries()),
    startTime: Date.now(),
  };
}

export function errorStatus(error: unknown, fallback: number): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : fallback;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function handlerFailureError(response: Response): Error & { status: number } {
  const message = response.statusText || `Handler returned HTTP ${response.status}`;
  return Object.assign(new Error(message), { status: response.status });
}
