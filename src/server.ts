import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';
import { filterEvmNetworks } from './protocols/evm.js';
import { filterSolanaNetworks } from './protocols/solana.js';
import type { RouterConfig, X402Server } from './types.js';
import {
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
} from './x402-facilitators.js';
import { getConfiguredX402Networks } from './x402-config.js';

export async function createX402Server(config: RouterConfig) {
  // Dynamic ESM imports: peer deps are loaded lazily so the router can
  // boot without them installed. await import() is bundler-safe (unlike
  // require() which Turbopack's __require polyfill silently breaks).
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

/**
 * Memoize getSupported() per process and degrade to a synthesized response
 * on persistent failure. See `.claude/18` for the cold-start 429 background.
 */
function withMemoizedGetSupported(
  inner: FacilitatorClient,
  failureFallback: SupportedResponse['kinds'],
): FacilitatorClient {
  let inFlight: Promise<SupportedResponse> | null = null;
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async () => {
      if (!inFlight) {
        inFlight = inner.getSupported().catch((err) => {
          console.warn(
            `[router] facilitator getSupported() failed; using fallback kinds: ${err instanceof Error ? err.message : String(err)}`,
          );
          inFlight = null; // let the next call retry
          return { kinds: failureFallback, extensions: [], signers: {} };
        });
      }
      return inFlight;
    },
  };
}

function createFacilitatorClients(
  facilitatorsByNetwork: ReturnType<typeof getResolvedX402Facilitators>,
  HTTPFacilitatorClient: new (config?: FacilitatorConfig) => FacilitatorClient,
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(facilitatorsByNetwork);

  return groups.map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    const kinds = group.networks.flatMap((network) => {
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
      if (group.family === 'evm') {
        return [exactKind, { x402Version: 2 as const, scheme: 'upto' as const, network }];
      }
      return [exactKind];
    });
    return withMemoizedGetSupported(inner, kinds);
  });
}
