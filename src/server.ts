import type { RouterConfig } from './types.js';

// Re-export the server type for internal use
export type X402Server = Awaited<ReturnType<typeof createX402Server>>['server'];

export function createX402Server(config: RouterConfig) {
  // Dynamic imports to avoid issues when peer deps are not installed
  const { x402ResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');
  const { registerExactEvmScheme } = require('@x402/evm/exact/server');
  const { bazaarResourceServerExtension } = require('@x402/extensions/bazaar');
  const { siwxResourceServerExtension } = require('@x402/extensions/sign-in-with-x');
  const { facilitator: defaultFacilitator } = require('@coinbase/x402');

  const facilitatorUrl = config.facilitatorUrl ?? defaultFacilitator;
  const client = new HTTPFacilitatorClient(facilitatorUrl);
  const server = new x402ResourceServer(client);

  registerExactEvmScheme(server);
  server.registerExtension(bazaarResourceServerExtension);
  server.registerExtension(siwxResourceServerExtension);

  const initPromise = retryInit(server);

  return { server, initPromise };
}

async function retryInit(
  server: { init(): Promise<void> },
  maxAttempts = 3,
  backoff = [1000, 2000, 4000],
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await server.init();
      return;
    } catch (err: unknown) {
      const is429 =
        err instanceof Error && (err.message.includes('429') || err.message.includes('rate limit'));
      if (!is429 || attempt === maxAttempts - 1) throw err;
      await new Promise((r) => setTimeout(r, backoff[attempt] ?? 4000));
    }
  }
}
