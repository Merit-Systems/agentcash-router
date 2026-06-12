import type { FacilitatorClient } from '@x402/core/http';
import type { KvStore } from './client.js';

const FACILITATOR_SUPPORTED_TTL_SECONDS = 60 * 60;
const FACILITATOR_SUPPORTED_KV_PREFIX = 'x402:facilitator-supported:';

type SupportedResponse = Awaited<ReturnType<FacilitatorClient['getSupported']>>;

export interface FacilitatorSupportedCacheOptions {
  kv?: KvStore;
  /** Stable per-facilitator identifier (typically its URL). KV caching is skipped when unset. */
  cacheKey?: string;
  ttlSeconds?: number;
  fallback?: () => SupportedResponse;
}

// getSupported() carries facilitator-provided extras the upto scheme needs
// (e.g. facilitatorAddress, which the client signs into the Permit2 witness).
// On serverless, every cold start would otherwise re-fetch /supported. The kv
// layer shares the response across instances; the in-memory memo dedups
// concurrent challenges in the same process and expires after the TTL so
// long-running servers (Hono) refresh it like everyone else.
export function withCachedSupported(
  inner: FacilitatorClient,
  options: FacilitatorSupportedCacheOptions = {},
): FacilitatorClient {
  const { kv, cacheKey, ttlSeconds = FACILITATOR_SUPPORTED_TTL_SECONDS, fallback } = options;
  const kvKey = kv && cacheKey ? `${FACILITATOR_SUPPORTED_KV_PREFIX}${cacheKey}` : undefined;
  let memo: { promise: Promise<SupportedResponse>; expiresAt: number } | undefined;

  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: () => {
      if (memo && Date.now() < memo.expiresAt) return memo.promise;
      const attempt = fetchSupported(inner, kv, kvKey, ttlSeconds, fallback);
      const entry = { promise: attempt, expiresAt: Date.now() + ttlSeconds * 1000 };
      memo = entry;
      attempt.catch(() => {
        if (memo === entry) memo = undefined;
      });
      return attempt;
    },
  };
}

async function fetchSupported(
  inner: FacilitatorClient,
  kv: KvStore | undefined,
  kvKey: string | undefined,
  ttlSeconds: number,
  fallback: (() => SupportedResponse) | undefined,
): Promise<SupportedResponse> {
  if (kv && kvKey) {
    const cached = await readKvCache(kv, kvKey);
    if (cached) return cached;
  }

  const fresh = await tryFetchLive(inner, fallback);
  if (fresh === null) return fallback!();

  if (kv && kvKey) await writeKvCache(kv, kvKey, fresh, ttlSeconds);
  return fresh;
}

async function tryFetchLive(
  inner: FacilitatorClient,
  fallback: (() => SupportedResponse) | undefined,
): Promise<SupportedResponse | null> {
  try {
    return await inner.getSupported();
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

async function readKvCache(kv: KvStore, key: string): Promise<SupportedResponse | undefined> {
  try {
    const cached = await kv.get(key);
    return isSupportedResponse(cached) ? cached : undefined;
  } catch {
    return undefined;
  }
}

async function writeKvCache(
  kv: KvStore,
  key: string,
  value: SupportedResponse,
  ttlSeconds: number,
): Promise<void> {
  try {
    await kv.setNxEx(key, value, ttlSeconds);
  } catch {
    // best-effort; another instance may already hold the key
  }
}

function isSupportedResponse(value: unknown): value is SupportedResponse {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as SupportedResponse).kinds)
  );
}
