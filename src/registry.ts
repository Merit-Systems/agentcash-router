import type { RouteEntry } from './types.js';

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();

  // Silently overwrites on duplicate key. Next.js module loading order is
  // non-deterministic during build — discovery stubs and real handlers may
  // register the same route key in either order. Last writer wins.
  // Prior art: ElysiaJS uses the same pattern (silent overwrite in router.history).
  register(entry: RouteEntry): void {
    if (
      this.routes.has(entry.key) &&
      typeof process !== 'undefined' &&
      process.env?.['NODE_ENV'] !== 'production'
    ) {
      console.warn(
        `[agentcash/router] route '${entry.key}' registered twice — overwriting (this is expected for discovery stubs during next build)`,
      );
    }
    this.routes.set(entry.key, entry);
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

}
