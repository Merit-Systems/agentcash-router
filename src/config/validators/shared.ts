import type { RouterConfig } from '../../types.js';
import { isEvmNetwork } from '../../protocols/x402/evm.js';
import { isSolanaNetwork } from '../../protocols/x402/solana.js';
import { getConfiguredX402Networks } from '../../protocols/x402/accepts.js';

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isEvmPrivateKey(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function isSupportedX402Network(network: string): boolean {
  return isEvmNetwork(network) || isSolanaNetwork(network);
}

export function findPlaceholderPayee(values: readonly (string | undefined)[]): string | null {
  return values.find((value) => value !== undefined && /^0x0{40}$/i.test(value)) ?? null;
}

export function usesDefaultEvmFacilitator(config: RouterConfig): boolean {
  return (
    getConfiguredX402Networks(config).some(
      (network) => typeof network === 'string' && isEvmNetwork(network),
    ) && config.x402?.facilitators?.evm === undefined
  );
}
