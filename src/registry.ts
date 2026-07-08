import type { RouteEntry } from './types.js';

/** The composed request handler produced by `.handler()` / `.stream()` — the same function returned to per-file Next.js routes. */
export type RegisteredHandler = (request: Request) => Promise<Response>;

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();
  private handlers = new Map<string, RegisteredHandler>();

  /**
   * Invoked on every registration. `createRouter` uses this to mount the route
   * on the internal Hono app, deduping by path so each distinct path is mounted
   * once. Firing on every register (not just the first key+method) means a
   * re-registration that changes the path also mounts the new path — both URLs
   * then dispatch to the latest handler (last write wins), instead of the new
   * URL 404ing.
   */
  onRegister?: (entry: RouteEntry) => void;

  private mapKey(entry: RouteEntry): string {
    return `${entry.key}:${entry.method}`;
  }

  /**
   * Record a route entry (and, when provided, its composed request handler —
   * required for `router.fetch()` dispatch; discovery-only stubs may omit it).
   * Re-registering a key+method overwrites both, so the last write wins.
   */
  register(entry: RouteEntry, handler?: RegisteredHandler): void {
    const k = this.mapKey(entry);
    if (
      this.routes.has(k) &&
      typeof process !== 'undefined' &&
      process.env?.['NODE_ENV'] !== 'production'
    ) {
      console.warn(
        `[agentcash/router] route '${entry.key}' (${entry.method}) registered twice — overwriting (this is expected for discovery stubs during next build)`,
      );
    }
    this.routes.set(k, entry);
    if (handler) this.handlers.set(k, handler);
    this.onRegister?.(entry);
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

  get(key: string): RouteEntry | undefined {
    const direct = this.routes.get(key);
    if (direct) return direct;
    for (const entry of this.routes.values()) {
      if (entry.key === key) return entry;
    }
    return undefined;
  }

  entries(): IterableIterator<[string, RouteEntry]> {
    return this.routes.entries();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.routes.size;
  }

  validate(expectedKeys?: string[]): void {
    if (!expectedKeys) return;
    const registeredPathKeys = new Set([...this.routes.values()].map((e) => e.key));
    const missing = expectedKeys.filter((k) => !registeredPathKeys.has(k));
    if (missing.length > 0) {
      throw new Error(
        `route${missing.length > 1 ? 's' : ''} ${missing.map((k) => `'${k}'`).join(', ')} ` +
          `expected but not registered — add to barrel imports ` +
          `(declared in discovery.expectRoutes or the deprecated prices map)`,
      );
    }
  }
}
