/**
 * `.nextStep()` resolution — shared by the response-time `next` injection
 * (`applyNextSteps`, called from `finalize`) and the discovery surfaces
 * (OpenAPI `links` / `x-next`, well-known + llms.txt workflows).
 *
 * Everything advertised about a step is derived from the target's own
 * `RouteEntry` at resolution time (method, auth mode, price), so chains stay
 * deterministic and never drift from the routes they point at.
 */
import { compareDecimals } from '../pricing/format.js';
import type { RouteRegistry } from '../registry.js';
import type { AuthMode, NextStepConfig, RouteEntry, RouteMethod } from '../types.js';
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

/** Static description of a nextStep edge, for discovery surfaces. */
export interface NextStepDescriptor {
  route: string;
  method: RouteMethod;
  urlTemplate: string;
  auth: AuthMode;
  price?: NextPrice;
  note?: string;
}

export function buildNextStepDescriptor(
  config: NextStepConfig,
  target: RouteEntry,
  baseUrl: string,
  basePath: string,
): NextStepDescriptor {
  const price = routeNextPrice(target);
  return {
    route: config.route,
    method: target.method,
    urlTemplate: buildRouteUrl(baseUrl, basePath, target.path ?? target.key),
    auth: target.authMode,
    ...(price !== undefined && { price }),
    ...(config.note !== undefined && { note: config.note }),
  };
}

/** A resolved `next` array entry, appended to successful JSON responses. */
export interface NextEntry {
  method: RouteMethod;
  url: string;
  auth: AuthMode;
  price?: NextPrice;
  note?: string;
  /** Suggested request body for non-GET targets, from `args()` keys that did not fill a path param. */
  body?: Record<string, unknown>;
}

/**
 * Append the declared `next` steps to a successful JSON response. No-ops
 * (returning the inputs unchanged) when the route declares no steps, the
 * response is an error, the handler returned a raw `Response` / non-object /
 * stream, or the handler already supplied a `next` key (handler wins).
 * `args`/`when` exceptions and missing targets are reported as warnings and
 * never break the response.
 */
export function applyNextSteps(
  ctx: FlowCtx,
  response: Response,
  rawResult: unknown,
): { response: Response; rawResult: unknown } {
  const unchanged = { response, rawResult };
  const steps = ctx.routeEntry.nextSteps;
  if (!steps || steps.length === 0 || !ctx.routing) return unchanged;
  if (response.status >= 400) return unchanged;
  if (!isPlainResultObject(rawResult)) return unchanged;
  if ('next' in rawResult) return unchanged;

  const entries = buildNextEntries(ctx, ctx.routing, steps, rawResult);
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
): NextEntry[] {
  const entries: NextEntry[] = [];

  for (const step of steps) {
    try {
      if (step.when && !step.when(result)) continue;
    } catch (error) {
      ctx.report('warn', `nextStep '${step.route}': when() threw — skipping: ${reason(error)}`);
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
      args = step.args?.(result);
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
      ...(suggestedBody !== undefined && { body: suggestedBody }),
    });
  }

  return entries;
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

/** One step of a discovery-rendered workflow chain. */
export interface WorkflowStep {
  method: RouteMethod;
  url: string;
  auth: AuthMode;
  price?: NextPrice;
  note?: string;
}

const MAX_WORKFLOW_DEPTH = 10;

/**
 * Walk the nextStep graph into linear chains for discovery. Roots are routes
 * that declare steps but are not targets themselves; branching produces one
 * chain per path. Cycles stop at the first revisit; depth is capped at
 * {@link MAX_WORKFLOW_DEPTH}. Ordering is deterministic: roots sort by key
 * then method, branches follow declaration order.
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
    for (const step of entry.nextSteps) targets.add(step.route);
  }

  const roots = sources
    .filter((entry) => !targets.has(entry.key))
    .sort((a, b) => a.key.localeCompare(b.key) || a.method.localeCompare(b.method));

  const chains: WorkflowStep[][] = [];

  const walk = (entry: RouteEntry, chain: WorkflowStep[], visited: Set<string>): void => {
    const steps = entry.nextSteps ?? [];
    let extended = false;
    if (chain.length < MAX_WORKFLOW_DEPTH) {
      for (const step of steps) {
        if (visited.has(step.route)) continue;
        const target = registry.get(step.route);
        if (!target) continue;
        extended = true;
        walk(
          target,
          [...chain, workflowStep(target, step.note ?? target.description, baseUrl, basePath)],
          new Set(visited).add(step.route),
        );
      }
    }
    if (!extended) chains.push(chain);
  };

  for (const root of roots) {
    walk(root, [workflowStep(root, root.description, baseUrl, basePath)], new Set([root.key]));
  }

  return chains;
}

function workflowStep(
  entry: RouteEntry,
  note: string | undefined,
  baseUrl: string,
  basePath: string,
): WorkflowStep {
  const price = routeNextPrice(entry);
  return {
    method: entry.method,
    url: buildRouteUrl(baseUrl, basePath, entry.path ?? entry.key),
    auth: entry.authMode,
    ...(price !== undefined && { price }),
    ...(note !== undefined && { note }),
  };
}
