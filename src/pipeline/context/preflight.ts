import type { NextRequest } from 'next/server';
import type { HandlerContext, RouteEntry } from '../../types.js';
import type { RouteHandler } from '../../orchestrate.js';
import { HEADERS } from '../../headers.js';
import type { PluginContext, RequestMeta } from '../../plugin.js';
import { createDefaultContext, firePluginHook } from '../../plugin.js';
import type { FlowCtx, RouterDeps } from './types.js';

export function preflight(
  routeEntry: RouteEntry,
  handler: RouteHandler,
  deps: RouterDeps,
  request: NextRequest,
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
  };
}

function buildMeta(request: NextRequest, routeEntry: RouteEntry): RequestMeta {
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
