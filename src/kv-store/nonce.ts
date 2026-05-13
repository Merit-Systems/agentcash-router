import type { KvStore } from './client.js';

/** SIWX challenge expiry in milliseconds. */
export const SIWX_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

export interface NonceStore {
  /** Returns `true` if the nonce is fresh (and marks it used); `false` if it has been seen. */
  check(nonce: string): Promise<boolean>;
}

/** In-memory nonce store for development and tests. Not durable across restarts. */
export class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>();

  async check(nonce: string): Promise<boolean> {
    this.evict();
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, Date.now() + SIWX_CHALLENGE_EXPIRY_MS);
    return true;
  }

  private evict() {
    const now = Date.now();
    for (const [n, exp] of this.seen) {
      if (exp < now) this.seen.delete(n);
    }
  }
}

export interface KvNonceStoreOptions {
  /** Key prefix. Default: `'siwx:nonce:'`. */
  prefix?: string;
  /** TTL in milliseconds. Default: `SIWX_CHALLENGE_EXPIRY_MS` (5 minutes). */
  ttlMs?: number;
}

/** KV-backed nonce store. Uses `SET key val EX ttl NX` for atomic single-use semantics. */
export function createKvNonceStore(kv: KvStore, options?: KvNonceStoreOptions): NonceStore {
  const prefix = options?.prefix ?? 'siwx:nonce:';
  const ttlSeconds = Math.ceil((options?.ttlMs ?? SIWX_CHALLENGE_EXPIRY_MS) / 1000);

  return {
    async check(nonce: string): Promise<boolean> {
      return kv.setNxEx(`${prefix}${nonce}`, 1, ttlSeconds);
    },
  };
}
