import type { FacilitatorConfig } from '@x402/core/http';
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
  const client = new HTTPFacilitatorClient(facilitatorConfig);
  const server = new x402ResourceServer(client);

  registerExactEvmScheme(server);
  server.registerExtension(bazaarResourceServerExtension);
  server.registerExtension(siwxResourceServerExtension);

  const initPromise = retryInit(server as unknown as X402Server);

  return { server: server as unknown as X402Server, initPromise };
}

async function retryInit(
  server: Pick<X402Server, 'initialize' | 'supportedResponsesMap'>,
  maxAttempts = 3,
  backoff = [1000, 2000, 4000],
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await server.initialize();
      if (server.supportedResponsesMap.size === 0) {
        throw new Error('x402 facilitator returned no supported schemes');
      }
      return;
    } catch (err: unknown) {
      if (attempt === maxAttempts - 1) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[router] x402 init attempt ${attempt + 1}/${maxAttempts} failed: ${msg}, retrying...`);
      await new Promise((r) => setTimeout(r, backoff[attempt] ?? 4000));
    }
  }
}
