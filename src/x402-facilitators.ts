import type { FacilitatorConfig } from '@x402/core/http';
import type { Network, PaymentRequirements } from '@x402/core/types';
import { isEvmNetwork } from './protocols/evm.js';
import { isSolanaNetwork } from './protocols/solana.js';
import type { RouterConfig, X402FacilitatorTarget, X402RouterFacilitatorConfig } from './types.js';

export const DEFAULT_SOLANA_FACILITATOR_URL = 'https://facilitator.corbits.dev';

export interface ResolvedX402Facilitator {
  family: 'evm' | 'solana';
  network: Network;
  url?: string;
  config: X402RouterFacilitatorConfig;
}

export interface ResolvedX402FacilitatorGroup {
  family: 'evm' | 'solana';
  config: X402RouterFacilitatorConfig;
  networks: Network[];
}

export function getResolvedX402Facilitator(
  config: RouterConfig,
  network: string,
  defaultEvmFacilitator: X402FacilitatorTarget,
): ResolvedX402Facilitator | null {
  const family = getNetworkFamily(network);
  if (!family) return null;

  const target = resolveX402FacilitatorTarget(config, network, defaultEvmFacilitator);
  const resolvedConfig = normalizeFacilitatorTarget(target);

  return {
    family,
    network: network as Network,
    url: resolvedConfig.url,
    config: resolvedConfig,
  };
}

export function getResolvedX402Facilitators(
  config: RouterConfig,
  networks: readonly string[],
  defaultEvmFacilitator: X402FacilitatorTarget,
): Record<string, ResolvedX402Facilitator> {
  return Object.fromEntries(
    networks.flatMap((network) => {
      const facilitator = getResolvedX402Facilitator(config, network, defaultEvmFacilitator);
      return facilitator ? [[network, facilitator]] : [];
    }),
  );
}

export function getResolvedX402FacilitatorGroups(
  facilitatorsByNetwork: Record<string, ResolvedX402Facilitator>,
): ResolvedX402FacilitatorGroup[] {
  const groups: ResolvedX402FacilitatorGroup[] = [];

  for (const facilitator of Object.values(facilitatorsByNetwork)) {
    const existing = groups.find(
      (group) =>
        group.family === facilitator.family &&
        sameFacilitatorConfig(group.config, facilitator.config),
    );

    if (existing) {
      existing.networks.push(facilitator.network);
      continue;
    }

    groups.push({
      family: facilitator.family,
      config: facilitator.config,
      networks: [facilitator.network],
    });
  }

  return groups;
}

export function getFacilitatorForRequirement(
  facilitatorsByNetwork: Record<string, ResolvedX402Facilitator> | undefined,
  requirement: PaymentRequirements,
): ResolvedX402Facilitator | undefined {
  return facilitatorsByNetwork?.[requirement.network];
}

export async function getAcceptsHeadersForFacilitator(
  facilitator: ResolvedX402Facilitator,
): Promise<Record<string, string>> {
  if (facilitator.config.createAcceptsHeaders) {
    return facilitator.config.createAcceptsHeaders();
  }

  if (facilitator.config.createAuthHeaders) {
    const headers = await facilitator.config.createAuthHeaders();
    return headers.supported;
  }

  return {};
}

export function getHTTPFacilitatorConfig(facilitator: {
  config: FacilitatorConfig;
}): FacilitatorConfig {
  return facilitator.config;
}

function resolveX402FacilitatorTarget(
  config: RouterConfig,
  network: string,
  defaultEvmFacilitator: X402FacilitatorTarget,
): X402FacilitatorTarget {
  return (
    (isSolanaNetwork(network) ? config.x402?.facilitators?.solana : undefined) ??
    (isEvmNetwork(network) ? config.x402?.facilitators?.evm : undefined) ??
    config.facilitatorUrl ??
    (isSolanaNetwork(network) ? DEFAULT_SOLANA_FACILITATOR_URL : defaultEvmFacilitator)
  );
}

function normalizeFacilitatorTarget(target: X402FacilitatorTarget): X402RouterFacilitatorConfig {
  return typeof target === 'string' ? { url: target } : target;
}

function getNetworkFamily(network: string): 'evm' | 'solana' | null {
  if (isEvmNetwork(network)) return 'evm';
  if (isSolanaNetwork(network)) return 'solana';
  return null;
}

function sameFacilitatorConfig(
  a: X402RouterFacilitatorConfig,
  b: X402RouterFacilitatorConfig,
): boolean {
  return (
    a.url === b.url &&
    a.createAuthHeaders === b.createAuthHeaders &&
    a.createAcceptsHeaders === b.createAcceptsHeaders
  );
}
