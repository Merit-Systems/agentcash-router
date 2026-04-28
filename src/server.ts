import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';
import { filterEvmNetworks } from './protocols/evm.js';
import { filterSolanaNetworks } from './protocols/solana.js';
import type { RouterConfig, X402Server } from './types.js';
import {
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
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
  const facilitatorsByNetwork = getResolvedX402Facilitators(
    config,
    configuredNetworks,
    defaultFacilitator,
  );
  const evmNetworks = filterEvmNetworks(configuredNetworks);
  const svmNetworks = filterSolanaNetworks(configuredNetworks);
  const facilitatorClients = createFacilitatorClients(facilitatorsByNetwork, HTTPFacilitatorClient);
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

/**
 * Wrap an HTTPFacilitatorClient so getSupported() is fetched at most once per
 * process, with a hardcoded fallback if the real call fails.
 *
 * Why a wrapper: getSupported() can be called multiple times during a request
 * (challenge build, verify, settle), and on Vercel each cold start spawns a
 * new process. Without caching, N simultaneous cold starts can blast the
 * facilitator with /supported and get 429'd (see .claude/18).
 *
 * Why fetch the real response at all: schemes like `upto` require facilitator-
 * specific `extra` fields (e.g. `facilitatorAddress` for the Permit2 witness)
 * that we can't synthesize locally. We fetch once, cache the result, and serve
 * it from memory thereafter.
 *
 * Why a fallback: if the real getSupported() fails (network glitch, persistent
 * 429), we degrade gracefully — exact routes keep working with the synthesized
 * `fallbackKinds`; upto routes will return a 402 that's missing
 * `extra.facilitatorAddress`, and the agentcash CLI surfaces a clear error.
 */
function cachedClient(
  inner: FacilitatorClient,
  fallbackKinds: SupportedResponse['kinds'],
): FacilitatorClient {
  let cachedPromise: Promise<SupportedResponse> | null = null;
  return {
    verify: inner.verify.bind(inner),
    settle: inner.settle.bind(inner),
    getSupported: async (): Promise<SupportedResponse> => {
      if (!cachedPromise) {
        cachedPromise = inner.getSupported().catch((err) => {
          console.warn(
            `[router] facilitator getSupported() failed; falling back to hardcoded kinds: ${err instanceof Error ? err.message : String(err)}`,
          );
          // Reset the cache so a subsequent successful call can populate it.
          cachedPromise = null;
          return { kinds: fallbackKinds, extensions: [], signers: {} };
        });
      }
      return cachedPromise;
    },
  };
}

function createFacilitatorClients(
  facilitatorsByNetwork: ReturnType<typeof getResolvedX402Facilitators>,
  HTTPFacilitatorClient: new (config?: FacilitatorConfig) => FacilitatorClient,
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(facilitatorsByNetwork);

  return groups.map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    const kinds = group.networks.flatMap((network) => {
      const exactKind = {
        x402Version: 2 as const,
        scheme: 'exact' as const,
        network,
        ...(group.family === 'solana'
          ? {
              extra: {
                features: {
                  xSettlementAccountSupported: true,
                },
              },
            }
          : {}),
      };
      if (group.family === 'evm') {
        return [exactKind, { x402Version: 2 as const, scheme: 'upto' as const, network }];
      }
      return [exactKind];
    });
    return cachedClient(inner, kinds);
  });
}
