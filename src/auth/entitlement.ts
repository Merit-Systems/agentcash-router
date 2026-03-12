export interface EntitlementStore {
  has(route: string, wallet: string): Promise<boolean>;
  grant(route: string, wallet: string): Promise<void>;
}

/**
 * In-memory SIWX entitlement store.
 *
 * Suitable for development and tests. Not durable across server restarts.
 */
export class MemoryEntitlementStore implements EntitlementStore {
  private readonly routeToWallets = new Map<string, Set<string>>();

  async has(route: string, wallet: string): Promise<boolean> {
    const wallets = this.routeToWallets.get(route);
    if (!wallets) return false;
    return wallets.has(wallet);
  }

  async grant(route: string, wallet: string): Promise<void> {
    let wallets = this.routeToWallets.get(route);
    if (!wallets) {
      wallets = new Set<string>();
      this.routeToWallets.set(route, wallets);
    }
    wallets.add(wallet);
  }
}

type RedisClientType = 'upstash' | 'ioredis';

function detectRedisClientType(client: unknown): RedisClientType {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'createRedisEntitlementStore requires a Redis client. Supported: @upstash/redis, ioredis.',
    );
  }

  if ('options' in client && 'status' in client) return 'ioredis';

  const constructor = (client as { constructor?: { name?: string } }).constructor?.name;
  if (constructor === 'Redis' && 'url' in client) return 'upstash';

  if (
    typeof (client as { sadd?: unknown }).sadd === 'function' &&
    typeof (client as { sismember?: unknown }).sismember === 'function'
  ) {
    return 'upstash';
  }

  throw new Error('Unrecognized Redis client for entitlement store.');
}

export interface RedisEntitlementStoreOptions {
  /** Key prefix. Default: 'siwx:entitlement:' */
  prefix?: string;
}

/**
 * Redis-backed entitlement store for paid+SIWX acceleration.
 */
export function createRedisEntitlementStore(
  client: unknown,
  options?: RedisEntitlementStoreOptions,
): EntitlementStore {
  const clientType = detectRedisClientType(client);
  const prefix = options?.prefix ?? 'siwx:entitlement:';

  return {
    async has(route: string, wallet: string): Promise<boolean> {
      const key = `${prefix}${route}`;

      if (clientType === 'upstash') {
        const redis = client as {
          sismember: (key: string, member: string) => Promise<number | boolean>;
        };
        const result = await redis.sismember(key, wallet);
        return result === 1 || result === true;
      }

      const redis = client as {
        sismember: (key: string, member: string) => Promise<number>;
      };
      const result = await redis.sismember(key, wallet);
      return result === 1;
    },

    async grant(route: string, wallet: string): Promise<void> {
      const key = `${prefix}${route}`;

      if (clientType === 'upstash') {
        const redis = client as {
          sadd: (key: string, member: string) => Promise<number>;
        };
        await redis.sadd(key, wallet);
        return;
      }

      const redis = client as {
        sadd: (key: string, member: string) => Promise<number>;
      };
      await redis.sadd(key, wallet);
    },
  };
}
