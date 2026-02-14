import type { RouteEntry } from './types.js';

export class RouteRegistry {
  private routes = new Map<string, RouteEntry>();

  register(entry: RouteEntry): void {
    if (this.routes.has(entry.key)) {
      throw new Error(`route '${entry.key}': already registered (duplicate route key)`);
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

  validate(expectedKeys?: string[]): void {
    if (!expectedKeys) return;
    const missing = expectedKeys.filter((k) => !this.routes.has(k));
    if (missing.length > 0) {
      throw new Error(
        `route${missing.length > 1 ? 's' : ''} ${missing.map((k) => `'${k}'`).join(', ')} ` +
          `in prices map but not registered — add to barrel imports`,
      );
    }
  }
}
