import type { FacilitatorClient } from '@x402/core/http';
import type { KvStore } from './client.js';

export const FACILITATOR_SUPPORTED_TTL_SECONDS = 60 * 60;
export const FACILITATOR_SUPPORTED_KV_PREFIX = 'x402:facilitator-supported:';

type SupportedResponse = Awaited<ReturnType<FacilitatorClient['getSupported']>>;

export interface FacilitatorSupportedCacheOptions {
  kv?: KvStore;
  /** Stable per-facilitator identifier (typically its URL). KV caching is skipped when unset. */
  cacheKey?: string;
  ttlSeconds?: number;
}

// getSupported() carries facilitator-provided extras the upto scheme needs
// (e.g. facilitatorAddress, which the client signs into the Permit2 witness).
// On serverless, every cold start would otherwise re-fetch /supported. The kv
// layer shares the response across instances; the in-memory promise dedups
// concurrent challenges in the same process.
export function withCachedSupported(
  inner: FacilitatorClient,
  options: FacilitatorSupportedCacheOptions = {},
): FacilitatorClient {
  const { kv, cacheKey, ttlSeconds = FACILITATOR_SUPPORTED_TTL_SECONDS } = options;
  const kvKey = kv && cacheKey ? `${FACILITATOR_SUPPORTED_KV_PREFIX}${cacheKey}` : null;
  let inflight: Promise<SupportedResponse> | undefined;

  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: () => {
      if (inflight) return inflight;
      if (!kv || !kvKey) {
        inflight = inner.getSupported();
        return inflight;
      }
      inflight = (async () => {
        try {
          const cached = await kv.get(kvKey);
          if (cached) return cached as SupportedResponse;
        } catch {
          // KV read failure must not break payment challenges
        }
        const fresh = await inner.getSupported();
        try {
          await kv.setNxEx(kvKey, fresh, ttlSeconds);
        } catch {
          // best-effort write; another instance may already hold the key
        }
        return fresh;
      })();
      return inflight;
    },
  };
}
