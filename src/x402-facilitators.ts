import type { FacilitatorConfig } from '@x402/core/http';
import type { Network, PaymentRequirements } from '@x402/core/types';
import { isEvmNetwork } from './protocols/evm.js';
import { isSolanaNetwork } from './protocols/solana.js';
import type { RouterConfig, X402FacilitatorTarget } from './types.js';

export const DEFAULT_SOLANA_FACILITATOR_URL = 'https://facilitator.corbits.dev';

export interface ResolvedX402FacilitatorGroup {
  family: 'evm' | 'solana';
  config: FacilitatorConfig;
  networks: Network[];
}

export function getResolvedX402FacilitatorConfig(
  config: RouterConfig,
  network: string,
  defaultEvmFacilitator: X402FacilitatorTarget,
): FacilitatorConfig {
  const target = resolveX402FacilitatorTarget(config, network, defaultEvmFacilitator);
  return typeof target === 'string' ? { url: target } : target;
}

export function getResolvedX402FacilitatorUrls(
  config: RouterConfig,
  networks: readonly string[],
  defaultEvmFacilitator: X402FacilitatorTarget,
): Record<string, string | undefined> {
  return Object.fromEntries(
    networks.map((network) => [
      network,
      getResolvedX402FacilitatorConfig(config, network, defaultEvmFacilitator).url,
    ]),
  );
}

export function getResolvedX402FacilitatorGroups(
  config: RouterConfig,
  networks: readonly string[],
  defaultEvmFacilitator: X402FacilitatorTarget,
): ResolvedX402FacilitatorGroup[] {
  const groups: ResolvedX402FacilitatorGroup[] = [];

  for (const network of networks) {
    const family = getNetworkFamily(network);
    if (!family) continue;

    const facilitatorConfig = getResolvedX402FacilitatorConfig(
      config,
      network,
      defaultEvmFacilitator,
    );
    const existing = groups.find(
      (group) => group.family === family && sameFacilitatorConfig(group.config, facilitatorConfig),
    );

    if (existing) {
      existing.networks.push(network as Network);
      continue;
    }

    groups.push({
      family,
      config: facilitatorConfig,
      networks: [network as Network],
    });
  }

  return groups;
}

export function getFacilitatorUrlForRequirement(
  facilitatorUrlsByNetwork: Record<string, string | undefined> | undefined,
  requirement: PaymentRequirements,
): string | undefined {
  return facilitatorUrlsByNetwork?.[requirement.network];
}

function resolveX402FacilitatorTarget(
  config: RouterConfig,
  network: string,
  defaultEvmFacilitator: X402FacilitatorTarget,
): X402FacilitatorTarget {
  return (
    config.x402?.facilitators?.networks?.[network] ??
    (isSolanaNetwork(network) ? config.x402?.facilitators?.solana : undefined) ??
    (isEvmNetwork(network) ? config.x402?.facilitators?.evm : undefined) ??
    config.facilitatorUrl ??
    (isSolanaNetwork(network) ? DEFAULT_SOLANA_FACILITATOR_URL : defaultEvmFacilitator)
  );
}

function getNetworkFamily(network: string): 'evm' | 'solana' | null {
  if (isEvmNetwork(network)) return 'evm';
  if (isSolanaNetwork(network)) return 'solana';
  return null;
}

function sameFacilitatorConfig(a: FacilitatorConfig, b: FacilitatorConfig): boolean {
  return a.url === b.url && a.createAuthHeaders === b.createAuthHeaders;
}
