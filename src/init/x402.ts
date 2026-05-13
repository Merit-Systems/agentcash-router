import type { RouterConfig, X402Server } from '../types.js';
import type { ResolvedX402Facilitators } from '../protocols/x402/facilitators.js';

export interface X402InitResult {
  server?: X402Server;
  facilitatorsByNetwork?: ResolvedX402Facilitators;
  initError?: string;
}

export async function initX402(
  config: RouterConfig,
  configError?: string,
): Promise<X402InitResult> {
  if (configError) return { initError: configError };

  try {
    const { createX402Server } = await import('../server.js');
    const result = await createX402Server(config);
    await result.initPromise;
    return {
      server: result.server,
      facilitatorsByNetwork: result.facilitatorsByNetwork,
    };
  } catch (err) {
    return { initError: err instanceof Error ? err.message : String(err) };
  }
}
