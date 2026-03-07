import type { RouteEntry } from './types.js';

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();

  // Internal map key includes the HTTP method so that POST and DELETE on the
  // same path coexist. Within the same path+method, last-write-wins is still
  // intentional — Next.js module loading order is non-deterministic during
  // build and discovery stubs may register the same route in either order.
  // Prior art: ElysiaJS uses the same pattern (silent overwrite in router.history).
  private mapKey(entry: RouteEntry): string {
    return `${entry.key}:${entry.method}`;
  }

  register(entry: RouteEntry): void {
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
  }

  get(key: string): RouteEntry | undefined {
    return this.routes.get(key);
  }

  entries(): IterableIterator<[string, RouteEntry]> {
    return this.routes.entries();
  }

  has(key: string): boolean {
    return this.routes.has(key);
  }

  get size(): number {
    return this.routes.size;
  }

  validate(expectedKeys?: string[]): void {
    if (!expectedKeys) return;
    // expectedKeys are path-only (e.g. "site/domain") — check that at least
    // one method is registered for each key.
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
