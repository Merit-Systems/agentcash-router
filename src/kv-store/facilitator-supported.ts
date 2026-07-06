import type { FacilitatorClient } from '@x402/core/http';
import type { KvStore } from './client.js';

const FACILITATOR_SUPPORTED_TTL_SECONDS = 60 * 60;
const FACILITATOR_SUPPORTED_KV_PREFIX = 'x402:facilitator-supported:';

type SupportedResponse = Awaited<ReturnType<FacilitatorClient['getSupported']>>;
type KindsResponse = { kinds: unknown[] };

export interface FacilitatorSupportedCacheOptions<T = SupportedResponse> {
  kv?: KvStore;
  /** Stable per-facilitator identifier (typically its URL). KV caching is skipped when unset. */
  cacheKey?: string;
  ttlSeconds?: number;
  fallback?: () => T;
}

// /supported responses carry facilitator-provided extras (e.g. facilitatorAddress
// for the upto Permit2 witness, feePayer for Solana challenge enrichment) and are
// near-static. On serverless, every cold start would otherwise re-fetch /supported.
// The kv layer shares the response across instances; the in-memory promise dedups
// concurrent challenges in the same process.
export function createCachedSupportedFetch<T extends KindsResponse>(
  fetchLive: () => Promise<T>,
  options: FacilitatorSupportedCacheOptions<T> = {},
): () => Promise<T> {
  const { kv, cacheKey, ttlSeconds = FACILITATOR_SUPPORTED_TTL_SECONDS, fallback } = options;
  const kvKey = kv && cacheKey ? `${FACILITATOR_SUPPORTED_KV_PREFIX}${cacheKey}` : undefined;
  let inflight: Promise<T> | undefined;

  return () => {
    if (inflight) return inflight;
    const attempt = fetchSupported(fetchLive, kv, kvKey, ttlSeconds, fallback);
    inflight = attempt;
    attempt.catch(() => {
      if (inflight === attempt) inflight = undefined;
    });
    return attempt;
  };
}

export function withCachedSupported(
  inner: FacilitatorClient,
  options: FacilitatorSupportedCacheOptions = {},
): FacilitatorClient {
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: createCachedSupportedFetch(() => inner.getSupported(), options),
  };
}

async function fetchSupported<T extends KindsResponse>(
  fetchLive: () => Promise<T>,
  kv: KvStore | undefined,
  kvKey: string | undefined,
  ttlSeconds: number,
  fallback: (() => T) | undefined,
): Promise<T> {
  if (kv && kvKey) {
    const cached = await readKvCache<T>(kv, kvKey);
    if (cached) return cached;
  }

  const fresh = await tryFetchLive(fetchLive, fallback);
  if (fresh === null) return fallback!();

  if (kv && kvKey) await writeKvCache(kv, kvKey, fresh, ttlSeconds);
  return fresh;
}

async function tryFetchLive<T>(
  fetchLive: () => Promise<T>,
  fallback: (() => T) | undefined,
): Promise<T | null> {
  try {
    return await fetchLive();
  } catch (err) {
    if (!fallback) throw err;
    console.warn(
      `[x402] facilitator /supported failed, using hardcoded baseline: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

async function readKvCache<T extends KindsResponse>(
  kv: KvStore,
  key: string,
): Promise<T | undefined> {
  try {
    const cached = await kv.get(key);
    return isKindsResponse(cached) ? (cached as T) : undefined;
  } catch {
    return undefined;
  }
}

async function writeKvCache(
  kv: KvStore,
  key: string,
  value: KindsResponse,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.setNxEx(key, value, ttlSeconds);
  } catch {
    // best-effort; another instance may already hold the key
  }
}

function isKindsResponse(value: unknown): value is KindsResponse {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as KindsResponse).kinds)
  );
}
