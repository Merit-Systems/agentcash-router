import type { FacilitatorClient, FacilitatorConfig } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';
import type { KvStore } from '../../kv-store/index.js';
import { withCachedSupported } from '../../kv-store/facilitator-supported.js';
import {
  getResolvedX402FacilitatorGroups,
  type ResolvedX402Facilitators,
  type ResolvedX402FacilitatorGroup,
} from './facilitators.js';

export function createFacilitatorClients(
  facilitatorsByNetwork: ResolvedX402Facilitators,
  HTTPFacilitatorClient: new (config?: FacilitatorConfig) => FacilitatorClient,
  kvStore: KvStore | undefined,
): FacilitatorClient[] {
  return getResolvedX402FacilitatorGroups(facilitatorsByNetwork).map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    const baseline = (): SupportedResponse => ({
      kinds: buildSupportedKinds(group),
      extensions: [],
      signers: {},
    });
    if (group.family === 'solana') {
      return hardcodedSupportedClient(inner, baseline);
    }
    return withCachedSupported(inner, {
      kv: kvStore,
      cacheKey: group.config.url,
      fallback: baseline,
    });
  });
}

function hardcodedSupportedClient(
  inner: FacilitatorClient,
  build: () => SupportedResponse,
): FacilitatorClient {
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async () => build(),
  };
}

function buildSupportedKinds(group: ResolvedX402FacilitatorGroup): SupportedResponse['kinds'] {
  return group.networks.flatMap((network) => {
    if (group.family === 'solana') {
      return [
        {
          x402Version: 2 as const,
          scheme: 'exact' as const,
          network,
          extra: { features: { xSettlementAccountSupported: true } },
        },
      ];
    }
    return [
      { x402Version: 2 as const, scheme: 'exact' as const, network },
      { x402Version: 2 as const, scheme: 'upto' as const, network },
    ];
  });
}
