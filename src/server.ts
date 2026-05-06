import type { FacilitatorConfig, FacilitatorClient } from '@x402/core/http';
import { filterEvmNetworks } from './protocols/x402/evm.js';
import { filterSolanaNetworks } from './protocols/x402/solana.js';
import type { RouterConfig, X402Server } from './types.js';
import {
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
  type ResolvedX402FacilitatorGroup,
} from './protocols/x402/facilitators.js';
import { getConfiguredX402Networks } from './protocols/x402/accepts.js';
import { withCachedGetSupported } from './protocols/x402/supported.js';

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
  const facilitatorClients = createFacilitatorClients(
    facilitatorsByNetwork,
    HTTPFacilitatorClient,
    config.x402?.supportedCache,
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
  cacheConfig: NonNullable<RouterConfig['x402']>['supportedCache'],
): FacilitatorClient[] {
  const groups = getResolvedX402FacilitatorGroups(facilitatorsByNetwork);

  return groups.map((group) => {
    const inner = new HTTPFacilitatorClient(group.config);
    const fallbackKinds = buildFallbackKinds(group);
    return withCachedGetSupported(inner, {
      cacheKey: facilitatorCacheKey(group),
      fallbackKinds,
      store: cacheConfig?.store ?? null,
      ttlMs: cacheConfig?.ttlMs,
    });
  });
}

/**
 * Stable identifier for caching. Different facilitators (CDP vs Corbits vs
 * self-hosted) advertise different `/supported` payloads, so URL is the
 * primary discriminator. Networks are appended so a single facilitator URL
 * serving multiple network groupings doesn't share a slot — sorted to keep
 * the key deterministic across instances.
 */
function facilitatorCacheKey(group: ResolvedX402FacilitatorGroup): string {
  const url = group.config.url ?? 'default';
  const nets = [...group.networks].sort().join(',');
  return `${url}|${nets}`;
}

/**
 * Hardcoded kinds returned when `/supported` fails persistently. Covers the
 * `exact` scheme (works without facilitator metadata) and advertises `upto`
 * for EVM. `upto` requires `extra.facilitatorAddress` from a real `/supported`
 * response to construct Permit2 witnesses, so it degrades — the kind is
 * advertised but clients can't actually pay until `/supported` recovers.
 */
function buildFallbackKinds(group: ResolvedX402FacilitatorGroup) {
  return group.networks.flatMap((network) => {
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
}
