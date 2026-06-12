import type { RouteEntry } from './types.js';

export type RegisteredHandler = (request: Request) => Promise<Response>;

/** Tie-break order for key-only lookups of multi-method keys. */
const METHOD_LOOKUP_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function methodRank(method: string): number {
  const rank = METHOD_LOOKUP_ORDER.indexOf(method as (typeof METHOD_LOOKUP_ORDER)[number]);
  return rank === -1 ? METHOD_LOOKUP_ORDER.length : rank;
}

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();
  private handlers = new Map<string, RegisteredHandler>();

  /**
   * Invoked the first time a key+method pair is registered. `createRouter`
   * uses this to mount the route on the internal Hono app exactly once —
   * re-registrations (last write wins) only swap the handler in the map.
   */
  onFirstRegister?: (entry: RouteEntry) => void;

  private mapKey(entry: RouteEntry): string {
    return `${entry.key}:${entry.method}`;
  }

  register(entry: RouteEntry, handler?: RegisteredHandler): void {
    const k = this.mapKey(entry);
    const isFirst = !this.routes.has(k);
    if (!isFirst && typeof process !== 'undefined' && process.env?.['NODE_ENV'] !== 'production') {
      console.warn(
        `[agentcash/router] route '${entry.key}' (${entry.method}) registered twice — overwriting (this is expected for discovery stubs during next build)`,
      );
    }
    this.routes.set(k, entry);
    if (handler) this.handlers.set(k, handler);
    if (isFirst) this.onFirstRegister?.(entry);
  }

  /**
   * Request-time dispatcher preserving last-write-wins semantics: the handler
   * is looked up on every call, so re-registering a key+method routes new
   * requests to the newest handler.
   */
  dispatch(key: string, method: string): RegisteredHandler {
    return async (request: Request): Promise<Response> => {
      const handler = this.handlers.get(`${key}:${method}`);
      if (!handler) {
        return Response.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      return handler(request);
    };
  }

  /**
   * Look up a route by key (and optionally method). Exact `key:method`
   * lookups win; a key-only lookup of a key registered under multiple
   * methods returns the entry with the lowest method in
   * {@link METHOD_LOOKUP_ORDER} (GET → POST → PUT → PATCH → DELETE), so the
   * result is deterministic regardless of registration order.
   */
  get(key: string, method?: string): RouteEntry | undefined {
    if (method) return this.routes.get(`${key}:${method}`);
    const direct = this.routes.get(key);
    if (direct) return direct;
    let best: RouteEntry | undefined;
    for (const entry of this.routes.values()) {
      if (entry.key !== key) continue;
      if (!best || methodRank(entry.method) < methodRank(best.method)) best = entry;
    }
    return best;
  }

  entries(): IterableIterator<[string, RouteEntry]> {
    return this.routes.entries();
  }

  has(key: string, method?: string): boolean {
    return this.get(key, method) !== undefined;
  }

  get size(): number {
    return this.routes.size;
  }

  validate(expectedKeys?: string[]): void {
    const registeredPathKeys = new Set([...this.routes.values()].map((e) => e.key));

    if (expectedKeys) {
      const missing = expectedKeys.filter((k) => !registeredPathKeys.has(k));
      if (missing.length > 0) {
        throw new Error(
          `route${missing.length > 1 ? 's' : ''} ${missing.map((k) => `'${k}'`).join(', ')} ` +
            `in prices map but not registered — add to barrel imports`,
        );
      }
    }

    const missingTargets: string[] = [];
    for (const entry of this.routes.values()) {
      for (const step of entry.nextSteps ?? []) {
        if (!registeredPathKeys.has(step.route)) {
          missingTargets.push(`'${step.route}' (from '${entry.key}')`);
        }
      }
    }
    if (missingTargets.length > 0) {
      throw new Error(
        `nextStep target${missingTargets.length > 1 ? 's' : ''} ${missingTargets.join(', ')} ` +
          `not registered — add to barrel imports`,
      );
    }
  }
}
