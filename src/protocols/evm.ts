import type { Network, PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept } from '../types.js';

export function isEvmNetwork(network: string): network is `eip155:${string}` {
  return network.startsWith('eip155:');
}

export function filterEvmNetworks(networks: readonly string[]): Network[] {
  return networks.filter(isEvmNetwork) as Network[];
}

export function allNetworksAreEvm(networks: readonly string[]): boolean {
  return networks.length > 0 && networks.every(isEvmNetwork);
}

export function buildEvmExactOptions(
  accepts: readonly X402ResolvedAccept[],
  price: string,
): Array<{ scheme: 'exact'; network: `eip155:${string}`; price: string; payTo: string }> {
  return accepts
    .filter(
      (
        accept,
      ): accept is X402ResolvedAccept & {
        network: `eip155:${string}`;
        scheme: 'exact';
      } => accept.scheme === 'exact' && isEvmNetwork(accept.network),
    )
    .map(({ network, payTo }) => ({
      scheme: 'exact' as const,
      network,
      price,
      payTo,
    }));
}

export function isEvmRequirement(requirement: PaymentRequirements): boolean {
  return isEvmNetwork(requirement.network);
}
