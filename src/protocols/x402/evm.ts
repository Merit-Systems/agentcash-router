import type { Network } from '@x402/core/types';
import type { X402ResolvedAccept } from '../../types.js';

export function isEvmNetwork(network: string): network is `eip155:${string}` {
  return network.startsWith('eip155:');
}

export function filterEvmNetworks(networks: readonly string[]): Network[] {
  return networks.filter(isEvmNetwork) as Network[];
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

export function buildEvmUptoOptions(
  accepts: readonly X402ResolvedAccept[],
  price: string,
): Array<{
  scheme: 'upto';
  network: `eip155:${string}`;
  price: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}> {
  return accepts
    .filter(
      (
        accept,
      ): accept is X402ResolvedAccept & {
        network: `eip155:${string}`;
        scheme: 'upto';
      } => accept.scheme === 'upto' && isEvmNetwork(accept.network),
    )
    .map((accept) => ({
      scheme: 'upto' as const,
      network: accept.network,
      payTo: accept.payTo,
      price,
      ...(accept.maxTimeoutSeconds !== undefined
        ? { maxTimeoutSeconds: accept.maxTimeoutSeconds }
        : {}),
      ...(accept.extra ? { extra: accept.extra } : {}),
    }));
}
