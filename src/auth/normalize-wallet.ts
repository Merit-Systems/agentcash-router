/**
 * Normalize a wallet address for storage/comparison.
 * EVM addresses are case-insensitive (checksumming is cosmetic) → lowercase.
 * Solana base58 addresses are case-sensitive → preserve as-is.
 */
export function normalizeWalletAddress(address: string): string {
  return address.startsWith('0x') ? address.toLowerCase() : address;
}
