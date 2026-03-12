import type { Network, PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept } from '../types.js';

type ChallengeResource = {
  url: string;
  method: string;
  description?: string;
  mimeType: string;
};

export function isSolanaNetwork(network: string): network is `solana:${string}` {
  return network.startsWith('solana:');
}

export function filterSolanaNetworks(networks: readonly string[]): Network[] {
  return networks.filter(isSolanaNetwork) as Network[];
}

export function buildSolanaExactOptions(
  accepts: readonly X402ResolvedAccept[],
  price: string,
): Array<{ scheme: 'exact'; network: `solana:${string}`; price: string; payTo: string }> {
  return accepts
    .filter(
      (
        accept,
      ): accept is X402ResolvedAccept & {
        network: `solana:${string}`;
        scheme: 'exact';
      } => accept.scheme === 'exact' && isSolanaNetwork(accept.network),
    )
    .map(({ network, payTo }) => ({
      scheme: 'exact' as const,
      network,
      price,
      payTo,
    }));
}

export function hasSolanaAccepts(accepts: readonly X402ResolvedAccept[]): boolean {
  return accepts.some((accept) => isSolanaNetwork(accept.network));
}

export async function enrichRequirementsWithFacilitatorAccepts(
  facilitatorUrl: string,
  resource: ChallengeResource,
  requirements: PaymentRequirements[],
): Promise<PaymentRequirements[]> {
  const response = await fetch(`${facilitatorUrl.replace(/\/+$/, '')}/accepts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      x402Version: 2,
      resource,
      accepts: requirements,
    }),
  });

  if (!response.ok) {
    throw new Error(`Facilitator /accepts failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    accepts?: PaymentRequirements[];
  };
  if (!Array.isArray(body.accepts)) {
    throw new Error('Facilitator /accepts response did not include accepts');
  }

  return body.accepts;
}

export function isSolanaRequirement(requirement: PaymentRequirements): boolean {
  return isSolanaNetwork(requirement.network);
}
