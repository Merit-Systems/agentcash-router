import type { KvStore } from './client.js';

export const SIWX_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

export interface NonceStore {
  check(nonce: string): Promise<boolean>;
}

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
  prefix?: string;
  ttlMs?: number;
}

export function createKvNonceStore(kv: KvStore, options?: KvNonceStoreOptions): NonceStore {
  const prefix = options?.prefix ?? 'siwx:nonce:';
  const ttlSeconds = Math.ceil((options?.ttlMs ?? SIWX_CHALLENGE_EXPIRY_MS) / 1000);

  return {
    async check(nonce: string): Promise<boolean> {
      return kv.setNxEx(`${prefix}${nonce}`, 1, ttlSeconds);
    },
  };
}
