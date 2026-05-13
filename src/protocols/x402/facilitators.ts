import type { Network, PaymentRequirements } from '@x402/core/types';
import { isEvmNetwork } from './evm.js';
import { isSolanaNetwork } from './solana.js';
import { DEFAULT_SOLANA_FACILITATOR_URL } from '../../constants.js';
import type {
  RouterConfig,
  X402FacilitatorTarget,
  X402RouterFacilitatorConfig,
} from '../../types.js';

export type NetworkFamily = 'evm' | 'solana';

export interface ResolvedX402Facilitator {
  family: NetworkFamily;
  network: Network;
  url?: string;
  config: X402RouterFacilitatorConfig;
}

export type ResolvedX402Facilitators = Record<string, ResolvedX402Facilitator>;

export interface ResolvedX402FacilitatorGroup {
  family: NetworkFamily;
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
): ResolvedX402Facilitators {
  return Object.fromEntries(
    networks.flatMap((network) => {
      const facilitator = getResolvedX402Facilitator(config, network, defaultEvmFacilitator);
      return facilitator ? [[network, facilitator]] : [];
    }),
  );
}

export function getResolvedX402FacilitatorGroups(
  facilitatorsByNetwork: ResolvedX402Facilitators,
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
  facilitatorsByNetwork: ResolvedX402Facilitators | undefined,
  requirement: PaymentRequirements,
): ResolvedX402Facilitator | undefined {
  return facilitatorsByNetwork?.[requirement.network];
}

export function sameResolvedX402Facilitator(
  a: ResolvedX402Facilitator,
  b: ResolvedX402Facilitator,
): boolean {
  return sameFacilitatorConfig(a.config, b.config);
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

function resolveX402FacilitatorTarget(
  config: RouterConfig,
  network: string,
  defaultEvmFacilitator: X402FacilitatorTarget,
): X402FacilitatorTarget {
  return (
    (isSolanaNetwork(network) ? config.x402?.facilitators?.solana : undefined) ??
    (isEvmNetwork(network) ? config.x402?.facilitators?.evm : undefined) ??
    (isSolanaNetwork(network) ? DEFAULT_SOLANA_FACILITATOR_URL : defaultEvmFacilitator)
  );
}

function normalizeFacilitatorTarget(target: X402FacilitatorTarget): X402RouterFacilitatorConfig {
  return typeof target === 'string' ? { url: target } : target;
}

function getNetworkFamily(network: string): NetworkFamily | null {
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
