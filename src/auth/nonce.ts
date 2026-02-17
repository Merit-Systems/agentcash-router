/**
 * SIWX challenge expiry in milliseconds.
 * Currently not configurable per-route — this is a known limitation.
 * Future versions may add `siwx: { expiryMs }` to RouterConfig.
 */
export const SIWX_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface NonceStore {
  check(nonce: string): Promise<boolean>;
}

/**
 * In-memory nonce store for development and testing.
 * NOT suitable for production serverless environments (Vercel, etc.)
 * where each function invocation gets fresh memory.
 *
 * For production, use `createRedisNonceStore()` with Upstash or ioredis.
 */
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

// ---------------------------------------------------------------------------
// Redis Nonce Store
// ---------------------------------------------------------------------------

type RedisClientType = 'upstash' | 'ioredis';

/**
 * Detect Redis client type from runtime properties.
 * Supports @upstash/redis and ioredis.
 */
function detectRedisClientType(client: unknown): RedisClientType {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'createRedisNonceStore requires a Redis client. ' +
        'Supported: @upstash/redis, ioredis. ' +
        'Pass your Redis client instance as the first argument.',
    );
  }

  // ioredis has 'options' and 'status' properties
  if ('options' in client && 'status' in client) {
    return 'ioredis';
  }

  // Upstash Redis client has a 'url' property
  const constructor = (client as object).constructor?.name;
  if (constructor === 'Redis' && 'url' in client) {
    return 'upstash';
  }

  // Fallback: check if set() exists and assume Upstash-compatible
  // Upstash is primary target (Vercel deployments)
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

/**
 * Create a Redis-backed nonce store for production SIWX replay protection.
 * Auto-detects client type (Upstash or ioredis) and uses appropriate API.
 *
 * @example
 * ```ts
 * // Upstash (Vercel)
 * import { Redis } from '@upstash/redis';
 * const redis = new Redis({ url: process.env.UPSTASH_URL, token: process.env.UPSTASH_TOKEN });
 * const nonceStore = createRedisNonceStore(redis);
 *
 * // ioredis
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 * const nonceStore = createRedisNonceStore(redis);
 * ```
 */
export function createRedisNonceStore(client: unknown, opts?: RedisNonceStoreOptions): NonceStore {
  const prefix = opts?.prefix ?? 'siwx:nonce:';
  const ttlSeconds = Math.ceil((opts?.ttlMs ?? SIWX_CHALLENGE_EXPIRY_MS) / 1000);

  const clientType = detectRedisClientType(client);

  return {
    async check(nonce: string): Promise<boolean> {
      const key = `${prefix}${nonce}`;

      if (clientType === 'upstash') {
        // Upstash: set(key, value, { ex, nx }) returns value if set, null if exists
        const redis = client as {
          set: (k: string, v: string, opts: { ex: number; nx: boolean }) => Promise<string | null>;
        };
        const result = await redis.set(key, '1', { ex: ttlSeconds, nx: true });
        return result !== null;
      }

      if (clientType === 'ioredis') {
        // ioredis: set(key, value, 'EX', sec, 'NX') returns 'OK' if set, null if exists
        const redis = client as {
          set: (k: string, v: string, ex: 'EX', sec: number, nx: 'NX') => Promise<'OK' | null>;
        };
        const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }

      // Unreachable if detectRedisClientType works correctly
      throw new Error('Unknown Redis client type');
    },
  };
}
