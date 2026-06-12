import type { RouteEntry } from './types.js';

export type RegisteredHandler = (request: Request) => Promise<Response>;

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
          `in prices map but not registered — add to barrel imports`,
      );
    }
  }
}
