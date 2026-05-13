export function normalizeWalletAddress(address: string): string {
  const isEvm = /^0x/i.test(address);
  return isEvm ? normalizeEvmWalletAddress(address) : normalizeSolanaWalletAddress(address);
}

function normalizeEvmWalletAddress(address: string): string {
  return address.toLowerCase();
}

function normalizeSolanaWalletAddress(address: string): string {
  return address;
}
