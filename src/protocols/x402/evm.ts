import type { Network, PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept } from '../../types.js';

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

/**
 * Build options for EVM `upto` accepts, ready to feed to
 * `x402ResourceServer.buildPaymentRequirementsFromOptions(...)`. The locally
 * registered `UptoEvmScheme` produces fully-enriched requirements (Permit2Proxy
 * address, asset transfer method, asset name/version, facilitator address)
 * without an HTTP `/accepts` roundtrip — CDP doesn't expose `/accepts`.
 *
 * `price` is passed as a plain decimal `Money` string so the scheme applies its
 * own asset/decimals defaults from the facilitator's `/supported` response.
 * Passing an explicit `AssetAmount` would short-circuit the lookup and leave
 * the requirement missing `facilitatorAddress`/`name`/`version`, which the
 * client SDK requires to construct the Permit2 witness.
 */
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

export function isEvmRequirement(requirement: PaymentRequirements): boolean {
  return isEvmNetwork(requirement.network);
}
