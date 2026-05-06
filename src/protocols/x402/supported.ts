/**
 * Cache layer for facilitator `/supported` responses.
 *
 * The upto scheme reads `extra.facilitatorAddress` (and asset name/version,
 * Permit2Proxy address, etc.) from `/supported` to construct EIP-712 witnesses.
 * Hardcoding those fields isn't viable — they're per-facilitator and per-asset.
 * But hitting `/supported` on every request would amplify cold-burst load into
 * 429 floods, especially against the default CDP facilitator.
 *
 * Layered cache, fastest → slowest:
 *
 *   per-process memo  →  optional shared KV  →  HTTP /supported  →  fallback kinds
 *
 * Per-process memo dedupes concurrent calls within one lambda instance and
 * acts as a 0-roundtrip cache for the rest of that process's lifetime up to
 * `ttlMs`. With no shared store, it's the only defense against cold bursts —
 * `M` instances → `M` raw HTTP calls. With a shared store, the first instance
 * to fetch writes back and the rest read from KV at one roundtrip per cold
 * start, so the fleet collectively makes one HTTP call per `ttlMs` window.
 *
 * Failures are not cached — the next request retries. Per-process memo also
 * stays unset on failure, so within a single instance we don't poison the
 * cache with one bad response.
 */

import type { FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Loose async key-value interface for caching `/supported` responses across
 * lambda instances. Three methods, string values. Any KV that satisfies this
 * shape can be plugged in (Vercel KV, Redis, Cloudflare KV, in-memory, etc).
 *
 * String values rather than `unknown` because the cache layer owns JSON
 * parse/stringify — it serializes a `{ value, expiresAt }` envelope, not just
 * the raw response. String-typed I/O matches Redis/KV native shapes and avoids
 * surprises around JSON-coercion semantics across backends.
 *
 * mppx-shape stores (Upstash/Cloudflare/Redis adapters) can be wrapped via
 * `mppxStoreAdapter` below.
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
  /**
   * Stable identifier for this facilitator (typically a derivation of its URL
   * + the networks it serves). Used as the suffix of the KV key. Different
   * facilitators advertise different `/supported` payloads, so they must not
   * share a cache slot.
   */
  cacheKey: string;
  /** Time-to-live for both the per-process memo and the shared store entry. */
  ttlMs?: number;
  /** Optional shared store. When omitted, only per-process memoization applies. */
  store?: SupportedKVStore | null;
  /**
   * Hardcoded kinds returned when `/supported` fails persistently. For the
   * default `exact` scheme this is enough to keep paid routes functional;
   * `upto` routes degrade gracefully (clients miss `facilitatorAddress` and
   * fall back to the standard 402 retry behavior).
   */
  fallbackKinds: SupportedResponse['kinds'];
}

/**
 * Wrap a `FacilitatorClient` so its `getSupported()` is layered through the
 * cache hierarchy. `verify()` and `settle()` pass through unchanged — they
 * always need a real network call.
 */
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
      // L1: per-process memo. Avoids any I/O when fresh.
      if (memo && isFresh(memo)) return memo.value;

      // L2: shared store. One KV roundtrip; populates L1 on hit.
      const stored = await readStore(options.store, storeKey);
      if (stored && isFresh(stored)) {
        memo = stored;
        return stored.value;
      }

      // L3: HTTP. `inFlight` dedupes concurrent callers in this process so
      // we never fire a second HTTP request while one is outstanding.
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
          // Don't cache failures. Memo and store stay unset so the next call
          // retries. This is fine — `inFlight` still dedupes the burst.
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
 * Adapt an mppx-shape store (`get`/`put`/`delete` with `unknown` values)
 * into a `SupportedKVStore`. Lets users plug their existing
 * `config.mpp.store` into the x402 supported-response cache without coupling
 * the type definitions of these two systems.
 *
 * mppx's Upstash/Cloudflare/Redis adapters all serialize as strings under the
 * hood, so the round-trip is lossless. `unknown` returns are coerced to the
 * string the cache layer expects (JSON-stringifying objects that some KV
 * adapters auto-decode on read).
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
    // Cache is best-effort — never let a bad cache read fail the request.
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
