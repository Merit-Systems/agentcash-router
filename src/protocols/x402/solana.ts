import type { Network, PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept } from '../../types.js';
import type { KvStore } from '../../kv-store/index.js';
import { createCachedSupportedFetch } from '../../kv-store/facilitator-supported.js';
import type { ResolvedX402Facilitator } from './facilitators.js';
import { getSupportedHeadersForFacilitator } from './facilitators.js';

type SupportedKind = {
  scheme?: string;
  network?: string;
  asset?: string;
  extra?: Record<string, unknown>;
};

type SupportedBody = { kinds: SupportedKind[] };

const SUPPORTED_FETCH_TIMEOUT_MS = 10_000;

export function isSolanaNetwork(network: string): network is `solana:${string}` {
  return network.startsWith('solana:');
}

export function filterSolanaNetworks(networks: readonly string[]): Network[] {
  return networks.filter(isSolanaNetwork) as Network[];
}

export function buildSolanaExactOptions(
  accepts: readonly X402ResolvedAccept[],
  price: string,
): Array<{ scheme: 'exact'; network: `solana:${string}`; price: string; payTo: string }> {
  return accepts
    .filter(
      (
        accept,
      ): accept is X402ResolvedAccept & {
        network: `solana:${string}`;
        scheme: 'exact';
      } => accept.scheme === 'exact' && isSolanaNetwork(accept.network),
    )
    .map(({ network, payTo }) => ({
      scheme: 'exact' as const,
      network,
      price,
      payTo,
    }));
}

export function hasSolanaAccepts(accepts: readonly X402ResolvedAccept[]): boolean {
  return accepts.some((accept) => isSolanaNetwork(accept.network));
}

function facilitatorBaseUrl(facilitator: ResolvedX402Facilitator): string {
  if (!facilitator.url) {
    throw new Error(`Facilitator for ${facilitator.network} is missing a URL`);
  }
  return facilitator.url.replace(/\/+$/, '');
}

function matchesSupportedKind(requirement: PaymentRequirements, kind: SupportedKind): boolean {
  const scheme = requirement.scheme ?? 'exact';
  return kind.network === requirement.network && (kind.scheme ?? 'exact') === scheme;
}

async function fetchFacilitatorSupported(
  facilitator: ResolvedX402Facilitator,
): Promise<SupportedBody> {
  const authHeaders = await getSupportedHeadersForFacilitator(facilitator);
  const response = await fetch(`${facilitatorBaseUrl(facilitator)}/supported`, {
    headers: authHeaders,
    signal: AbortSignal.timeout(SUPPORTED_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Facilitator /supported failed with status ${response.status}`);
  }

  const body = (await response.json()) as { kinds?: SupportedKind[] };
  if (!Array.isArray(body.kinds)) {
    throw new Error('Facilitator /supported response did not include kinds');
  }

  return { kinds: body.kinds };
}

// Keyed by facilitator identity so each router instance caches independently;
// no fallback baseline — a failed fetch must drop enrichment, not memoize a
// feePayer-less response.
const supportedFetchers = new WeakMap<ResolvedX402Facilitator, () => Promise<SupportedBody>>();

function getCachedSupportedFetch(
  facilitator: ResolvedX402Facilitator,
  kv: KvStore | undefined,
): () => Promise<SupportedBody> {
  let fetcher = supportedFetchers.get(facilitator);
  if (!fetcher) {
    fetcher = createCachedSupportedFetch(() => fetchFacilitatorSupported(facilitator), {
      kv,
      cacheKey: facilitator.url,
    });
    supportedFetchers.set(facilitator, fetcher);
  }
  return fetcher;
}

function enrichRequirementFromKind(
  requirement: PaymentRequirements,
  kinds: SupportedKind[],
): PaymentRequirements {
  const kind = kinds.find((candidate) => matchesSupportedKind(requirement, candidate));
  if (!kind) {
    throw new Error(
      `Facilitator /supported has no kind for ${requirement.scheme} on ${requirement.network}`,
    );
  }

  const feePayer = (kind.extra as { feePayer?: string } | undefined)?.feePayer;
  if (!feePayer) {
    throw new Error(
      `Facilitator /supported kind for ${requirement.network} is missing extra.feePayer`,
    );
  }

  const requirementExtra = (requirement.extra ?? {}) as Record<string, unknown>;
  const kindExtra = kind.extra ?? {};
  const requirementFeatures = (requirementExtra.features ?? {}) as Record<string, unknown>;
  const kindFeatures = (kindExtra.features ?? {}) as Record<string, unknown>;
  // Capability flags (e.g. xSettlementAccountSupported) are only forwarded when
  // the facilitator advertises them — never asserted on its behalf.
  const features = { ...requirementFeatures, ...kindFeatures };

  return {
    ...requirement,
    ...(kind.asset && !requirement.asset ? { asset: kind.asset } : {}),
    extra: {
      ...requirementExtra,
      ...kindExtra,
      ...(Object.keys(features).length > 0 ? { features } : {}),
    },
  };
}

export async function enrichRequirementsFromFacilitatorSupported(
  facilitator: ResolvedX402Facilitator,
  requirements: PaymentRequirements[],
  kv?: KvStore,
): Promise<PaymentRequirements[]> {
  const { kinds } = await getCachedSupportedFetch(facilitator, kv)();
  return requirements.map((requirement) => enrichRequirementFromKind(requirement, kinds));
}

export function isSolanaRequirement(requirement: PaymentRequirements): boolean {
  return isSolanaNetwork(requirement.network);
}
