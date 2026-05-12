/** SIWX challenge expiry in milliseconds. */
export const SIWX_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

export interface NonceStore {
  check(nonce: string): Promise<boolean>;
}

/** In-memory nonce store for development and testing. Use `createRedisNonceStore()` in production. */
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

type RedisClientType = 'upstash' | 'ioredis';

function detectRedisClientType(client: unknown): RedisClientType {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'createRedisNonceStore requires a Redis client. ' +
        'Supported: @upstash/redis, ioredis. ' +
        'Pass your Redis client instance as the first argument.',
    );
  }

  if ('options' in client && 'status' in client) {
    return 'ioredis';
  }

  const constructor = (client as object).constructor?.name;
  if (constructor === 'Redis' && 'url' in client) {
    return 'upstash';
  }

  if (typeof (client as { set?: unknown }).set === 'function') {
    return 'upstash';
  }

  throw new Error(
    'Unrecognized Redis client. ' +
      'Supported: @upstash/redis, ioredis. ' +
      'If using a different client, implement NonceStore interface directly.',
  );
}

export interface RedisNonceStoreOptions {
  /** Key prefix for nonce storage. Default: 'siwx:nonce:' */
  prefix?: string;
  /** TTL in milliseconds. Default: SIWX_CHALLENGE_EXPIRY_MS (5 minutes) */
  ttlMs?: number;
}

/** Create a Redis-backed nonce store for production SIWX replay protection. Supports @upstash/redis and ioredis. */
export function createRedisNonceStore(client: unknown, opts?: RedisNonceStoreOptions): NonceStore {
  const prefix = opts?.prefix ?? 'siwx:nonce:';
  const ttlSeconds = Math.ceil((opts?.ttlMs ?? SIWX_CHALLENGE_EXPIRY_MS) / 1000);

  const clientType = detectRedisClientType(client);

  return {
    async check(nonce: string): Promise<boolean> {
      const key = `${prefix}${nonce}`;

      if (clientType === 'upstash') {
        const redis = client as {
          set: (k: string, v: string, opts: { ex: number; nx: boolean }) => Promise<string | null>;
        };
        const result = await redis.set(key, '1', { ex: ttlSeconds, nx: true });
        return result !== null;
      }

      if (clientType === 'ioredis') {
        const redis = client as {
          set: (k: string, v: string, ex: 'EX', sec: number, nx: 'NX') => Promise<'OK' | null>;
        };
        const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }

      throw new Error('Unknown Redis client type: detectRedisClientType returned unexpected value');
    },
  };
}
