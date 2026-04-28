import { createRouter } from '@agentcash/router';

const payeeAddress = process.env.X402_PAYEE_ADDRESS;
if (!payeeAddress) {
  throw new Error('X402_PAYEE_ADDRESS is required');
}

const CORBITS_FACILITATOR_URL = 'https://facilitator.corbits.dev';

const mppConfig = process.env.MPP_SECRET_KEY
  ? {
      secretKey: process.env.MPP_SECRET_KEY,
      currency: '0x20c000000000000000000000b9537d11c60e8b50',
      recipient: payeeAddress,
      rpcUrl: process.env.TEMPO_RPC_URL,
      feePayerKey: process.env.MPP_FEE_PAYER_KEY,
    }
  : undefined;

export const router = createRouter({
  baseUrl: process.env.BASE_URL!,
  protocols: mppConfig ? ['x402', 'mpp'] : ['x402'],
  payeeAddress,
  x402: {
    facilitators: {
      solana: CORBITS_FACILITATOR_URL,
    },
    accepts: [
      { network: 'eip155:8453', payTo: payeeAddress },
      // `upto` accept enables post-work pricing on Base (see `fortune/upto`).
      // The router validates that any `.paid({ variable: true })` route on x402
      // has at least one upto-scheme accept on a configured network.
      {
        scheme: 'upto',
        network: 'eip155:8453',
        payTo: payeeAddress,
        // Base USDC
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      { network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', payTo: process.env.SOLANA_PAYEE_ADDRESS },
    ],
  },
  ...(mppConfig ? { mpp: mppConfig } : {}),
  discovery: {
    title: 'Fortune API',
    version: '1.0.0',
    description: 'Pay-per-call fortune telling API',
  },
  prices: {
    fortune: '0.001',
    'fortune/premium': '0.005',
  },
});
