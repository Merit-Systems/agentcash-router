import type { RouteEntry } from './types.js';

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();

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
