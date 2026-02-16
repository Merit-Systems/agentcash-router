export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const USDC_DECIMALS = 6;

export const DEFAULT_BASE_RPC = 'https://mainnet.base.org';

export const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<string, any>();

export async function getUsdcBalance(address: `0x${string}`, rpcUrl?: string): Promise<number> {
  const url = rpcUrl ?? DEFAULT_BASE_RPC;

  let client = clientCache.get(url);
  if (!client) {
    const { createPublicClient, http } = await import('viem');
    const { base } = await import('viem/chains');
    client = createPublicClient({ chain: base, transport: http(url) });
    clientCache.set(url, client);
  }

  const raw = (await client.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address],
  })) as bigint;

  return Number(raw) / 10 ** USDC_DECIMALS;
}
