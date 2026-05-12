import type { FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';

const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Async key-value interface for caching x402 `/supported` responses across
 * lambda instances. Wraps any KV (Vercel KV, Redis, Cloudflare KV). The cache
 * layer owns JSON serialization so values are strings.
 */
export interface SupportedKVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface CacheEntry {
  value: SupportedResponse;
  expiresAt: number;
}

interface CachedClientOptions {
  cacheKey: string;
  ttlMs?: number;
  store?: SupportedKVStore | null;
  fallbackKinds: SupportedResponse['kinds'];
}

export function withCachedGetSupported(
  inner: FacilitatorClient,
  options: CachedClientOptions,
): FacilitatorClient {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const storeKey = `x402:supported:${options.cacheKey}`;

  let memo: CacheEntry | null = null;
  let inFlight: Promise<SupportedResponse> | null = null;

  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async () => {
      if (memo && isFresh(memo)) return memo.value;

      const stored = await readStore(options.store, storeKey);
      if (stored && isFresh(stored)) {
        memo = stored;
        return stored.value;
      }

      if (inFlight) return inFlight;

      inFlight = (async () => {
        try {
          const response = await inner.getSupported();
          const entry: CacheEntry = {
            value: response,
            expiresAt: Date.now() + ttlMs,
          };
          memo = entry;
          await writeStore(options.store, storeKey, entry);
          return response;
        } catch (err) {
          console.warn(
            `[router] facilitator getSupported() failed; using fallback kinds: ${err instanceof Error ? err.message : String(err)}`,
          );
          return { kinds: options.fallbackKinds, extensions: [], signers: {} };
        } finally {
          inFlight = null;
        }
      })();

      return inFlight;
    },
  };
}

/**
 * Adapt an mppx-shape store (Upstash/Cloudflare/Redis) into a `SupportedKVStore`
 * so `config.mpp.store` can be reused as `config.x402.supportedCache.store`.
 */
export function mppxStoreAdapter(store: {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
}): SupportedKVStore {
  return {
    async get(key) {
      const raw = await store.get(key);
      if (raw == null) return null;
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
    },
    async put(key, value) {
      await store.put(key, value);
    },
    async delete(key) {
      await store.delete(key);
    },
  };
}

function isFresh(entry: CacheEntry): boolean {
  return entry.expiresAt > Date.now();
}

async function readStore(
  store: SupportedKVStore | null | undefined,
  key: string,
): Promise<CacheEntry | null> {
  if (!store) return null;
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (typeof entry?.expiresAt !== 'number' || !entry.value) return null;
    return entry;
  } catch (err) {
    console.warn(
      `[router] /supported store read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function writeStore(
  store: SupportedKVStore | null | undefined,
  key: string,
  entry: CacheEntry,
): Promise<void> {
  if (!store) return;
  try {
    await store.put(key, JSON.stringify(entry));
  } catch (err) {
    console.warn(
      `[router] /supported store write failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
