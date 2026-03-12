import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse, Network } from '@x402/core/types';
import { filterEvmNetworks } from './protocols/evm.js';
import { filterSolanaNetworks } from './protocols/solana.js';
import type { RouterConfig, X402Server } from './types.js';
import {
  getResolvedX402FacilitatorGroups,
  getResolvedX402FacilitatorUrls,
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
  const evmNetworks = filterEvmNetworks(configuredNetworks);
  const svmNetworks = filterSolanaNetworks(configuredNetworks);
  const facilitatorClients = createFacilitatorClients(
    config,
    configuredNetworks,
    defaultFacilitator,
    HTTPFacilitatorClient,
  );
  const server = new x402ResourceServer(
    facilitatorClients.length === 1 ? facilitatorClients[0] : facilitatorClients,
  );

  if (evmNetworks.length > 0) {
    registerExactEvmScheme(server, { networks: evmNetworks });
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
    facilitatorUrlsByNetwork: getResolvedX402FacilitatorUrls(
      config,
      configuredNetworks,
      defaultFacilitator,
    ),
  };
}

/**
 * Wrap an HTTPFacilitatorClient to return a hardcoded getSupported() response
 * for EVM exact scheme. verify() and settle() pass through to the real client.
 *
 * Why: getSupported() hits the Coinbase facilitator on every cold start.
 * On Vercel, N simultaneous cold starts blast the facilitator and get 429'd.
 * The EVM exact scheme's enhancePaymentRequirements() doesn't use the
 * supported kind data at all (it's a pass-through), so the HTTP call is pure
 * overhead and a reliability risk.
 */
function cachedClient(inner: FacilitatorClient, networks: Network[]): FacilitatorClient {
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async (): Promise<SupportedResponse> => ({
      kinds: networks.map((network) => ({ x402Version: 2, scheme: 'exact', network })),
      extensions: [],
      signers: {},
    }),
  };
}

function createFacilitatorClients(
  config: RouterConfig,
  configuredNetworks: readonly string[],
  defaultEvmFacilitator: string | FacilitatorConfig,
  HTTPFacilitatorClient: new (config?: FacilitatorConfig) => FacilitatorClient,
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(
    config,
    configuredNetworks,
    defaultEvmFacilitator,
  );

  return groups.map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    return group.family === 'evm' ? cachedClient(inner, group.networks) : inner;
  });
}
