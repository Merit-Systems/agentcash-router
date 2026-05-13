import { normalizeWalletAddress } from '../auth/normalize-wallet.js';
import type { KvStore } from './client.js';

export interface EntitlementStore {
  has(route: string, wallet: string): Promise<boolean>;
  grant(route: string, wallet: string): Promise<void>;
}

export class MemoryEntitlementStore implements EntitlementStore {
  private readonly routeToWallets = new Map<string, Set<string>>();

  async has(route: string, wallet: string): Promise<boolean> {
    const wallets = this.routeToWallets.get(route);
    if (!wallets) return false;
    return wallets.has(normalizeWalletAddress(wallet));
  }

  async grant(route: string, wallet: string): Promise<void> {
    const normalized = normalizeWalletAddress(wallet);
    let wallets = this.routeToWallets.get(route);
    if (!wallets) {
      wallets = new Set<string>();
      this.routeToWallets.set(route, wallets);
    }
    wallets.add(normalized);
  }
}

export interface KvEntitlementStoreOptions {
  prefix?: string;
}

export function createKvEntitlementStore(
  kv: KvStore,
  options?: KvEntitlementStoreOptions,
): EntitlementStore {
  const prefix = options?.prefix ?? 'siwx:ent:';

  return {
    async has(route: string, wallet: string): Promise<boolean> {
      return kv.sismember(`${prefix}${route}`, normalizeWalletAddress(wallet));
    },

    async grant(route: string, wallet: string): Promise<void> {
      await kv.sadd(`${prefix}${route}`, normalizeWalletAddress(wallet));
    },
  };
}
