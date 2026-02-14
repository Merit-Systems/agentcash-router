import type { RouterConfig } from './types.js';

// Re-export the server type for internal use
export type X402Server = Awaited<ReturnType<typeof createX402Server>>['server'];

export async function createX402Server(config: RouterConfig) {
  // Dynamic ESM imports: peer deps are loaded lazily so the router can
  // boot without them installed. await import() is bundler-safe (unlike
  // require() which Turbopack's __require polyfill silently breaks).
  const { x402ResourceServer, HTTPFacilitatorClient } = await import('@x402/core/server');
  const { registerExactEvmScheme } = await import('@x402/evm/exact/server');
  const { bazaarResourceServerExtension } = await import('@x402/extensions/bazaar');
  const { siwxResourceServerExtension } = await import('@x402/extensions/sign-in-with-x');
  const { facilitator: defaultFacilitator } = await import('@coinbase/x402');

  // facilitatorUrl may be string (from config) or FacilitatorConfig (from
  // @coinbase/x402 default). Cast to satisfy HTTPFacilitatorClient constructor.
  const facilitatorUrl = config.facilitatorUrl ?? defaultFacilitator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- facilitator accepts string URL or FacilitatorConfig
  const client = new HTTPFacilitatorClient(facilitatorUrl as any);
  const server = new x402ResourceServer(client);

  registerExactEvmScheme(server);
  server.registerExtension(bazaarResourceServerExtension);
  server.registerExtension(siwxResourceServerExtension);

  const initPromise = retryInit(server as unknown as { init(): Promise<void> });

  // Cast to Record<string, Function> — callers invoke server methods
  // dynamically (buildPaymentRequirementsFromOptions, verifyPayment, etc.)
  // since the x402 SDK types aren't re-exported from this package.
  return { server: server as unknown as Record<string, Function>, initPromise };
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
