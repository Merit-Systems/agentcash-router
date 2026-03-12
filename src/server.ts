import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse, Network } from '@x402/core/types';
import type { RouterConfig, X402Server } from './types.js';
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

  // Normalize string URLs into the config object shape; pass objects through.
  const raw = config.facilitatorUrl ?? defaultFacilitator;
  const facilitatorConfig: FacilitatorConfig = typeof raw === 'string' ? { url: raw } : raw;
  const httpClient = new HTTPFacilitatorClient(facilitatorConfig);
  const configuredNetworks = getConfiguredX402Networks(config) as Network[];
  const evmNetworks = configuredNetworks.filter((network) => network.startsWith('eip155:'));
  const svmNetworks = configuredNetworks.filter((network) => network.startsWith('solana:'));

  // Wrap the HTTP client to bypass getSupported() on cold start.
  // For EVM exact scheme, enhancePaymentRequirements is a no-op — the
  // supported kind data is never used. The only purpose of getSupported()
  // is a gate check ("does the facilitator support exact on eip155:8453?"),
  // which has been true since day one. Hitting the facilitator on every
  // lambda cold start causes 429 rate limit storms when multiple instances
  // boot simultaneously. Hardcode the response; verify/settle still go
  // through the real facilitator.
  const client =
    configuredNetworks.length > 0 &&
    configuredNetworks.every((network) => network.startsWith('eip155:'))
      ? cachedClient(httpClient, configuredNetworks)
      : httpClient;
  const server = new x402ResourceServer(client);

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

  return { server: server as unknown as X402Server, initPromise };
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
