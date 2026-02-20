import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse, Network } from '@x402/core/types';
import type { RouterConfig, X402Server } from './types.js';

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

  // Wrap the HTTP client to bypass getSupported() on cold start.
  // For EVM exact scheme, enhancePaymentRequirements is a no-op — the
  // supported kind data is never used. The only purpose of getSupported()
  // is a gate check ("does the facilitator support exact on eip155:8453?"),
  // which has been true since day one. Hitting the facilitator on every
  // lambda cold start causes 429 rate limit storms when multiple instances
  // boot simultaneously. Hardcode the response; verify/settle still go
  // through the real facilitator.
  const network = (config.network ?? 'eip155:8453') as Network;
  const client = cachedClient(httpClient, network);
  const server = new x402ResourceServer(client);

  registerExactEvmScheme(server);
  server.registerExtension(bazaarResourceServerExtension);
  server.registerExtension(siwxResourceServerExtension);

  const initPromise = server.initialize();

  return { server: server as unknown as X402Server, initPromise };
}

function cachedClient(inner: FacilitatorClient, network: Network): FacilitatorClient {
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async (): Promise<SupportedResponse> => ({
      kinds: [{ x402Version: 2, scheme: 'exact', network }],
      extensions: [],
      signers: {},
    }),
  };
}
