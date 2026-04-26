/**
 * Normalize a wallet address for storage/comparison.
 * EVM addresses are case-insensitive (checksumming is cosmetic) → lowercase.
 * Solana base58 addresses are case-sensitive → preserve as-is.
 */
export function normalizeWalletAddress(address: string): string {
  return /^0x/i.test(address) ? address.toLowerCase() : address;
}
