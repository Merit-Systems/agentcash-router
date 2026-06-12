/**
 * `.nextStep()` resolution. The runtime response-body `next` array
 * (`applyNextSteps`, called from `finalize`) is the SINGLE chaining channel:
 * always resolved against the actual result, `when()`-filtered, and priced at
 * response time. Chains are deliberately not mirrored into static discovery
 * (`x-next` / OpenAPI `links` / well-known `workflows` were removed) — a
 * static copy is strictly staler than the live one. The only static trace is
 * the map-level `## Workflows` summary (`buildWorkflowChains`), which rides
 * the guidance channel into llms.txt and OpenAPI `info.x-guidance`.
 *
 * For route-form steps, everything advertised is derived from the target's
 * own `RouteEntry` at resolution time (method, auth mode, price), so chains
 * stay deterministic and never drift from the routes they point at.
 * External-form steps resolve a third-party request from the result and are
 * advertised without `auth`/`price` (unknown for third-party hosts).
 */
import { compareDecimals } from '../pricing/format.js';
import type { RouteRegistry } from '../registry.js';
import type {
  AuthMode,
  ExternalNextStepConfig,
  ExternalRequest,
  NextStepConfig,
  NextStepRequestContext,
  RouteEntry,
  RouteMethod,
} from '../types.js';
import type { FlowCtx, RouteRouting } from './steps/types.js';

/** Advertised cost of calling a route: a fixed amount or a min/max range. Absent for free routes. */
export type NextPrice = string | { min: string; max: string };

export interface RoutePriceExtrema {
  min: string;
  max: string;
}

/**
 * Price extrema for a route entry: fixed prices collapse to `min === max`;
 * dynamic pricing uses the declared `minPrice`/`maxPrice` bounds; tiered
 * pricing takes the cheapest and most expensive tier. `null` for free routes.
 */
function routePriceExtrema(entry: RouteEntry): RoutePriceExtrema | null {
  if (!entry.pricing) return null;

  if (typeof entry.pricing === 'string') {
    return { min: entry.pricing, max: entry.pricing };
  }

  if (typeof entry.pricing === 'function') {
    return { min: entry.minPrice ?? '0', max: entry.maxPrice ?? '0' };
  }

  if ('tiers' in entry.pricing) {
    const extrema = tierPriceExtrema(Object.values(entry.pricing.tiers).map((tier) => tier.price));
    if (extrema) return extrema;
    return { min: '0', max: entry.maxPrice ?? '0' };
  }

  return null;
}

/** Cheapest/most-expensive tier prices; `null` when empty or unparseable. */
export function tierPriceExtrema(prices: string[]): RoutePriceExtrema | null {
  if (prices.length === 0) return null;
  let min = prices[0];
  let max = prices[0];
  try {
    for (const price of prices.slice(1)) {
      if (compareDecimals(price, min) < 0) min = price;
      if (compareDecimals(price, max) > 0) max = price;
    }
  } catch {
    return null;
  }
  return { min, max };
}

/** Compact price for `next` entries and workflow steps. Omitted (undefined) for free routes. */
function routeNextPrice(entry: RouteEntry): NextPrice | undefined {
  const extrema = routePriceExtrema(entry);
  if (!extrema) return undefined;
  return extrema.min === extrema.max ? extrema.min : extrema;
}

/** Fully-qualified URL for a route path template (`{param}` slots intact). */
export function buildRouteUrl(baseUrl: string, basePath: string, pathTemplate: string): string {
  const prefix = basePath ? `/${basePath}` : '';
  return `${baseUrl}${prefix}/${pathTemplate}`;
}

/** A resolved route-form `next` array entry, appended to successful JSON responses. */
export interface NextRouteEntry {
  method: RouteMethod;
  url: string;
  auth: AuthMode;
  price?: NextPrice;
  note?: string;
  retryAfterSeconds?: number;
  /** Suggested request body for non-GET targets, from `args()` keys that did not fill a path param. */
  body?: Record<string, unknown>;
}

/** A resolved external-form `next` array entry: a third-party request with no `auth`/`price` (unknown for third-party hosts). */
export interface NextExternalEntry {
  external: true;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  note?: string;
  retryAfterSeconds?: number;
}

/** A resolved `next` array entry, appended to successful JSON responses. */
export type NextEntry = NextRouteEntry | NextExternalEntry;

/**
 * Append the declared `next` steps to a successful JSON response. No-ops
 * (returning the inputs unchanged) when the route declares no steps, the
 * response is an error, the handler returned a raw `Response` / non-object /
 * stream, or the handler already supplied a `next` key (handler wins).
 * `args`/`when`/`external` exceptions and missing targets are reported as
 * warnings and never break the response. `requestBody` is the parsed request
 * body, threaded from `finalize` so route-form `args()` can derive values
 * the caller sent (it is `undefined` when no body was parsed).
 */
export function applyNextSteps(
  ctx: FlowCtx,
  response: Response,
  rawResult: unknown,
  requestBody?: unknown,
): { response: Response; rawResult: unknown } {
  const unchanged = { response, rawResult };
  const steps = ctx.routeEntry.nextSteps;
  if (!steps || steps.length === 0 || !ctx.routing) return unchanged;
  if (response.status >= 400) return unchanged;
  if (!isPlainResultObject(rawResult)) return unchanged;
  if ('next' in rawResult) return unchanged;

  const requestContext: NextStepRequestContext = {
    body: requestBody,
    query: ctx.query,
    params: ctx.params,
  };
  const entries = buildNextEntries(ctx, ctx.routing, steps, rawResult, requestContext);
  if (entries.length === 0) return unchanged;

  const body = { ...rawResult, next: entries };
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return {
    response: new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    rawResult: body,
  };
}

function isPlainResultObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Response)
  );
}

function buildNextEntries(
  ctx: FlowCtx,
  routing: RouteRouting,
  steps: NextStepConfig[],
  result: unknown,
  requestContext: NextStepRequestContext,
): NextEntry[] {
  const entries: NextEntry[] = [];

  for (const step of steps) {
    const label = step.route !== undefined ? `'${step.route}'` : '(external)';
    try {
      if (step.when && !step.when(result)) continue;
    } catch (error) {
      ctx.report('warn', `nextStep ${label}: when() threw — skipping: ${reason(error)}`);
      continue;
    }

    if (step.route === undefined) {
      const entry = buildExternalEntry(ctx, step, result);
      if (entry) entries.push(entry);
      continue;
    }

    // Module load order means a target can legitimately be unloaded in
    // per-file hosting mode — skip rather than break the response.
    const target = routing.registry.get(step.route);
    if (!target) {
      ctx.report('warn', `nextStep target '${step.route}' not registered — skipping`);
      continue;
    }

    let args: Record<string, unknown> | undefined;
    try {
      args = step.args?.(result, requestContext);
    } catch (error) {
      ctx.report('warn', `nextStep '${step.route}': args() threw — skipping: ${reason(error)}`);
      continue;
    }

    const { url, leftover } = resolveTargetUrl(routing, target, args);
    const price = routeNextPrice(target);
    const suggestedBody = target.method !== 'GET' && leftover ? leftover : undefined;

    entries.push({
      method: target.method,
      url,
      auth: target.authMode,
      ...(price !== undefined && { price }),
      ...(step.note !== undefined && { note: step.note }),
      ...(step.retryAfterSeconds !== undefined && { retryAfterSeconds: step.retryAfterSeconds }),
      ...(suggestedBody !== undefined && { body: suggestedBody }),
    });
  }

  return entries;
}

/**
 * Resolve an external-form step into a `next` entry. Returns `null` (skip)
 * when the resolver returns `null`/`undefined` or throws — exceptions are
 * reported as warnings and never break the response.
 */
function buildExternalEntry(
  ctx: FlowCtx,
  step: ExternalNextStepConfig,
  result: unknown,
): NextExternalEntry | null {
  let request: ExternalRequest | null | undefined;
  try {
    request = step.external(result);
  } catch (error) {
    ctx.report('warn', `nextStep (external): external() threw — skipping: ${reason(error)}`);
    return null;
  }
  if (request == null) return null;

  return {
    external: true,
    method: request.method ?? 'GET',
    url: request.url,
    ...(request.headers !== undefined && { headers: request.headers }),
    ...(request.body !== undefined && { body: request.body }),
    ...(step.note !== undefined && { note: step.note }),
    ...(step.retryAfterSeconds !== undefined && { retryAfterSeconds: step.retryAfterSeconds }),
  };
}

function resolveTargetUrl(
  routing: RouteRouting,
  target: RouteEntry,
  args: Record<string, unknown> | undefined,
): { url: string; leftover: Record<string, unknown> | undefined } {
  const template = target.path ?? target.key;
  if (!args) {
    // No args mapper: advertise the unresolved template as-is.
    return { url: buildRouteUrl(routing.baseUrl, routing.basePath, template), leftover: undefined };
  }

  const consumed = new Set<string>();
  const filled = template
    .split('/')
    .map((segment) => {
      const match = /^\{([^/}]+)\}$/.exec(segment);
      if (!match) return segment;
      const param = match[1];
      if (!(param in args)) return segment; // unmapped param stays a template slot
      consumed.add(param);
      return encodeURIComponent(String(args[param]));
    })
    .join('/');

  const leftoverEntries = Object.entries(args).filter(([key]) => !consumed.has(key));
  let url = buildRouteUrl(routing.baseUrl, routing.basePath, filled);

  if (leftoverEntries.length === 0) return { url, leftover: undefined };

  if (target.method === 'GET') {
    const query = new URLSearchParams();
    for (const [key, value] of leftoverEntries) query.set(key, String(value));
    url += `?${query.toString()}`;
    return { url, leftover: undefined };
  }

  return { url, leftover: Object.fromEntries(leftoverEntries) };
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One route-backed step of a discovery-rendered workflow chain. */
export interface WorkflowRouteStep {
  external?: undefined;
  method: RouteMethod;
  url: string;
  auth: AuthMode;
  price?: NextPrice;
  note?: string;
  retryAfterSeconds?: number;
}

/**
 * An external step of a workflow chain. The request is resolved from the
 * previous response at runtime, so nothing about it is known statically; it
 * terminates static traversal of its branch.
 */
export interface WorkflowExternalStep {
  external: true;
  note?: string;
  retryAfterSeconds?: number;
}

/** One step of a discovery-rendered workflow chain. */
export type WorkflowStep = WorkflowRouteStep | WorkflowExternalStep;

const MAX_WORKFLOW_DEPTH = 10;

/**
 * Walk the nextStep graph into linear chains for discovery. Roots are routes
 * that declare steps but are not targets themselves; branching produces one
 * chain per path. External steps are terminal: they render as a sentinel and
 * end their branch (no registry target to follow). Cycles stop at the first
 * revisit; depth is capped at {@link MAX_WORKFLOW_DEPTH}. Ordering is
 * deterministic: roots sort by key then method, branches follow declaration
 * order.
 */
export function buildWorkflowChains(
  registry: RouteRegistry,
  baseUrl: string,
  basePath: string,
): WorkflowStep[][] {
  const targets = new Set<string>();
  const sources: RouteEntry[] = [];
  for (const [, entry] of registry.entries()) {
    if (!entry.nextSteps || entry.nextSteps.length === 0) continue;
    sources.push(entry);
    for (const step of entry.nextSteps) {
      if (step.route !== undefined) targets.add(step.route);
    }
  }

  const byPosition = (a: RouteEntry, b: RouteEntry) =>
    a.key.localeCompare(b.key) || a.method.localeCompare(b.method);

  // Pure roots: sources that are not themselves targets. Cyclic graphs
  // (self-paginating routes, mutual detail links) can have NO pure roots —
  // every source is also a target — which previously rendered no map at all
  // while routes still advertised `next`. Cover them: after walking pure
  // roots, any source not reached yet seeds its own chain (cycles terminate
  // via the visited set, so this stays finite and deterministic).
  const roots = sources.filter((entry) => !targets.has(entry.key)).sort(byPosition);

  const reached = new Set<string>(roots.map((r) => r.key));
  const markReachable = (entry: RouteEntry, seen: Set<string>): void => {
    for (const step of entry.nextSteps ?? []) {
      if (step.route === undefined || seen.has(step.route)) continue;
      seen.add(step.route);
      reached.add(step.route);
      const target = registry.get(step.route);
      if (target) markReachable(target, seen);
    }
  };
  for (const root of roots) markReachable(root, new Set([root.key]));
  const cycleSeeds = sources.filter((entry) => !reached.has(entry.key)).sort(byPosition);
  for (const seed of cycleSeeds) {
    if (reached.has(seed.key)) continue; // an earlier seed's walk covered it
    reached.add(seed.key);
    markReachable(seed, new Set([seed.key]));
    roots.push(seed);
  }

  const chains: WorkflowStep[][] = [];

  const walk = (entry: RouteEntry, chain: WorkflowStep[], visited: Set<string>): void => {
    const steps = entry.nextSteps ?? [];
    let extended = false;
    if (chain.length < MAX_WORKFLOW_DEPTH) {
      for (const step of steps) {
        if (step.route === undefined) {
          // External step: a terminal leaf — the request only exists in the
          // previous response's `next` array, so there is nothing to follow.
          extended = true;
          chains.push([...chain, workflowExternalStep(step)]);
          continue;
        }
        if (visited.has(step.route)) continue;
        const target = registry.get(step.route);
        if (!target) continue;
        extended = true;
        walk(
          target,
          [
            ...chain,
            workflowStep(
              target,
              step.note ?? target.description,
              step.retryAfterSeconds,
              baseUrl,
              basePath,
            ),
          ],
          new Set(visited).add(step.route),
        );
      }
    }
    if (!extended) chains.push(chain);
  };

  for (const root of roots) {
    walk(
      root,
      [workflowStep(root, root.description, undefined, baseUrl, basePath)],
      new Set([root.key]),
    );
  }

  return chains;
}

function workflowStep(
  entry: RouteEntry,
  note: string | undefined,
  retryAfterSeconds: number | undefined,
  baseUrl: string,
  basePath: string,
): WorkflowRouteStep {
  const price = routeNextPrice(entry);
  return {
    method: entry.method,
    url: buildRouteUrl(baseUrl, basePath, entry.path ?? entry.key),
    auth: entry.authMode,
    ...(price !== undefined && { price }),
    ...(note !== undefined && { note }),
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
  };
}

function workflowExternalStep(step: ExternalNextStepConfig): WorkflowExternalStep {
  return {
    external: true,
    ...(step.note !== undefined && { note: step.note }),
    ...(step.retryAfterSeconds !== undefined && { retryAfterSeconds: step.retryAfterSeconds }),
  };
}
