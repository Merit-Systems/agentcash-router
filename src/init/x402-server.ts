import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';
import { filterEvmNetworks } from '../protocols/x402/evm.js';
import { filterSolanaNetworks } from '../protocols/x402/solana.js';
import type { RouterConfig, X402Server } from '../types.js';
import {
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
  type ResolvedX402FacilitatorGroup,
} from '../protocols/x402/facilitators.js';
import { getConfiguredX402Networks } from '../protocols/x402/accepts.js';

export async function createX402Server(config: RouterConfig) {
  const { x402ResourceServer, HTTPFacilitatorClient } = await import('@x402/core/server');
  const { registerExactEvmScheme } = await import('@x402/evm/exact/server');
  const { bazaarResourceServerExtension } = await import('@x402/extensions/bazaar');
  const { siwxResourceServerExtension } = await import('@x402/extensions/sign-in-with-x');
  const { facilitator: defaultFacilitator } = await import('@coinbase/x402');
  const configuredNetworks = getConfiguredX402Networks(config);
  const facilitatorsByNetwork = getResolvedX402Facilitators(
    config,
    configuredNetworks,
    defaultFacilitator,
  );
  const evmNetworks = filterEvmNetworks(configuredNetworks);
  const svmNetworks = filterSolanaNetworks(configuredNetworks);
  const facilitatorClients = createFacilitatorClients(facilitatorsByNetwork, HTTPFacilitatorClient);
  const server = new x402ResourceServer(
    facilitatorClients.length === 1 ? facilitatorClients[0] : facilitatorClients,
  );

  if (evmNetworks.length > 0) {
    registerExactEvmScheme(server, { networks: evmNetworks });
    const { UptoEvmScheme } = await import('@x402/evm/upto/server');
    for (const network of evmNetworks) {
      server.register(network, new UptoEvmScheme());
    }
  }
  if (svmNetworks.length > 0) {
    const { registerExactSvmScheme } = await import('@x402/svm/exact/server');
    registerExactSvmScheme(server, { networks: svmNetworks });
  }
  server.registerExtension(bazaarResourceServerExtension);
  server.registerExtension(siwxResourceServerExtension);

  const initPromise = server.initialize();

  return {
    server: server as unknown as X402Server,
    initPromise,
    facilitatorsByNetwork,
  };
}

function createFacilitatorClients(
  facilitatorsByNetwork: ReturnType<typeof getResolvedX402Facilitators>,
  HTTPFacilitatorClient: new (config?: FacilitatorConfig) => FacilitatorClient,
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(facilitatorsByNetwork);

  return groups.map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    const kinds = buildSupportedKinds(group);
    return hardcodedSupportedClient(inner, kinds);
  });
}

// getSupported() hits the facilitator on every cold start. On Vercel, N
// simultaneous cold starts blast the facilitator and get 429'd. The router
// only uses exact/upto on EVM and exact on Solana — all of which the CDP
// facilitator supports — so we bypass the network call entirely. verify()
// and settle() pass through to the real client.
function hardcodedSupportedClient(
  inner: FacilitatorClient,
  kinds: SupportedResponse['kinds'],
): FacilitatorClient {
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async () => ({ kinds, extensions: [], signers: {} }),
  };
}

function buildSupportedKinds(group: ResolvedX402FacilitatorGroup): SupportedResponse['kinds'] {
  return group.networks.flatMap((network) => {
    const exactKind = {
      x402Version: 2 as const,
      scheme: 'exact' as const,
      network,
      ...(group.family === 'solana'
        ? {
            extra: {
              features: {
                xSettlementAccountSupported: true,
              },
            },
          }
        : {}),
    };
    const uptoKind = { x402Version: 2 as const, scheme: 'upto' as const, network };
    if (group.family === 'evm') {
      return [exactKind, uptoKind];
    }
    return [exactKind, uptoKind];
  });
}
