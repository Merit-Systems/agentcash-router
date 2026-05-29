import { filterEvmNetworks } from '../protocols/x402/evm.js';
import { filterSolanaNetworks } from '../protocols/x402/solana.js';
import type { RouterConfig, X402Server } from '../types.js';
import { getResolvedX402Facilitators } from '../protocols/x402/facilitators.js';
import { createFacilitatorClients } from '../protocols/x402/facilitator-clients.js';
import { getConfiguredX402Networks } from '../protocols/x402/accepts.js';
import type { KvStore } from '../kv-store/index.js';

export async function createX402Server(config: RouterConfig, kvStore?: KvStore) {
  const { x402ResourceServer, HTTPFacilitatorClient } = await import('@x402/core/server');
  const { registerExactEvmScheme } = await import('@x402/evm/exact/server');
  const { bazaarResourceServerExtension } = await import('@x402/extensions/bazaar');
  const { createSIWxResourceServerExtension, InMemorySIWxStorage } =
    await import('@x402/extensions/sign-in-with-x');
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
  // `@x402/extensions@2.13.0` replaced the `siwxResourceServerExtension` value export with
  // this factory. We only rely on its `enrichPaymentRequiredResponse` hook, which refreshes
  // the SIWX challenge (nonce, issuedAt, domain, supportedChains) when `createPaymentRequiredResponse`
  // is built on the paid+SIWX path. The factory also wires `onAfterSettle`/`onProtectedRequest`
  // hooks backed by `storage`, but neither fires here: the router settles via the low-level
  // resource server with `declaredExtensions` unset (so the settle hook short-circuits) and never
  // uses the HTTP transport layer. Entitlement and nonce replay are owned by the router's own
  // pipeline (entitlementStore + nonceStore), so the storage passed here is intentionally inert.
  server.registerExtension(
    createSIWxResourceServerExtension({ storage: new InMemorySIWxStorage() }),
  );

  const initPromise = server.initialize();

  return {
    server: server as unknown as X402Server,
    initPromise,
    facilitatorsByNetwork,
  };
}
