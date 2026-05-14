import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import { filterEvmNetworks } from '../protocols/x402/evm.js';
import { filterSolanaNetworks } from '../protocols/x402/solana.js';
import type { RouterConfig, X402Server } from '../types.js';
import {
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
} from '../protocols/x402/facilitators.js';
import { getConfiguredX402Networks } from '../protocols/x402/accepts.js';
import type { KvStore } from '../kv-store/index.js';
import { withCachedSupported } from '../kv-store/facilitator-supported.js';

export async function createX402Server(config: RouterConfig, kvStore?: KvStore) {
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
  const facilitatorClients = createFacilitatorClients(
    facilitatorsByNetwork,
    HTTPFacilitatorClient,
    kvStore,
  );
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
  kvStore: KvStore | undefined,
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(facilitatorsByNetwork);
  return groups.map((group) =>
    withCachedSupported(new HTTPFacilitatorClient(group.config), {
      kv: kvStore,
      cacheKey: group.config.url,
    }),
  );
}
