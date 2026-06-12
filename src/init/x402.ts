import type { RouterConfig, X402Server } from '../types.js';
import type { ResolvedX402Facilitators } from '../protocols/x402/facilitators.js';
import type { KvStore } from '../kv-store/index.js';

export interface X402InitResult {
  server?: X402Server;
  facilitatorsByNetwork?: ResolvedX402Facilitators;
  initError?: string;
}

export async function initX402(
  config: RouterConfig,
  kvStore: KvStore | undefined,
): Promise<X402InitResult> {
  try {
    const { createX402Server } = await import('./x402-server.js');
    const result = await createX402Server(config, kvStore);
    await result.initPromise;
    return {
      server: result.server,
      facilitatorsByNetwork: result.facilitatorsByNetwork,
    };
  } catch (err) {
    return { initError: err instanceof Error ? err.message : String(err) };
  }
}
