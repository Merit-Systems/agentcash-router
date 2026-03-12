import { createRouter } from '@agentcash/router';

const payeeAddress = process.env.X402_PAYEE_ADDRESS;
const mppSecretKey = process.env.MPP_SECRET_KEY;

if (!payeeAddress) {
  throw new Error('X402_PAYEE_ADDRESS is required');
}

// MPP config (optional - only for testing MPP protocol)
const mppConfig = mppSecretKey
  ? {
      secretKey: mppSecretKey,
      currency: '0x20c000000000000000000000b9537d11c60e8b50', // PathUSD on Tempo mainnet (6 decimals)
      recipient: payeeAddress,
      rpcUrl: process.env.TEMPO_RPC_URL,
    }
  : undefined;

// Create router with both x402 and MPP support.
// SIWX routes support both EVM (Base) and Solana wallets via supportedChains.
export const router = createRouter({
  baseUrl: process.env.BASE_URL!,
  protocols: mppConfig ? ['x402', 'mpp'] : ['x402'],
  network: [
    'eip155:8453', // Base mainnet (EVM)
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
  ],
  payeeAddress,
  ...(mppConfig ? { mpp: mppConfig } : {}),
  prices: {
    fortune: '0.001', // $0.001 per fortune
    'fortune/premium': '0.005', // $0.005 per premium fortune
  },
});
