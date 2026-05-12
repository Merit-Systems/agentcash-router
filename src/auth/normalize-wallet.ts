export function normalizeWalletAddress(address: string): string {
  const isEvm = /^0x/i.test(address);
  return isEvm ? normalizeEvmWalletAddress(address) : normalizeSolanaWalletAddress(address);
}


export function normalizeEvmWalletAddress(address: string): string {
  return address.toLowerCase();
}

export function normalizeSolanaWalletAddress(address: string): string {
  return address;
}