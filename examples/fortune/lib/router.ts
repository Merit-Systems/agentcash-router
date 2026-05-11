import { createRouter } from '@agentcash/router';

const payeeAddress = process.env.X402_PAYEE_ADDRESS;
if (!payeeAddress) {
  throw new Error('X402_PAYEE_ADDRESS is required');
}

const CORBITS_FACILITATOR_URL = 'https://facilitator.corbits.dev';

// USDC on Base — needed by the `upto` accept (the scheme reads the asset
// metadata from the facilitator's /supported response to build Permit2
// witnesses).
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const mppConfig = process.env.MPP_SECRET_KEY
  ? {
      secretKey: process.env.MPP_SECRET_KEY,
      currency: '0x20c000000000000000000000b9537d11c60e8b50',
      recipient: payeeAddress,
      rpcUrl: process.env.TEMPO_RPC_URL,
      // operatorKey signs server-side on-chain ops (channel close/settle).
      // Its derived address MUST equal `recipient`/payee. Fee sponsorship
      // requires `feePayerKey` to be a DIFFERENT wallet (Tempo's
      // fee-delegated txs reject sender === fee-payer).
      operatorKey: process.env.MPP_OPERATOR_KEY,
      feePayerKey: process.env.MPP_FEE_PAYER_KEY,
      // Session mode: required for routes that opt into `dynamic: true` over
      // MPP. The router registers `tempo.session({ sse: true })` alongside
      // `tempo.charge`; channels persist across requests, vouchers cycle
      // transparently. `tickCost`/`unitType` are required per-route in
      // `.paid({ dynamic: true, tickCost, unitType, maxPrice })`.
      session: {},
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
      // Static-priced routes use `exact` (the default scheme).
      { scheme: 'exact', network: 'eip155:8453', payTo: payeeAddress },
      // Dynamic-priced routes (`.paid({ dynamic: true })`) need `upto` so the
      // operator can claim less than `maxPrice` post-handler. Permit2Proxy
      // enforces the cap on chain.
      {
        scheme: 'upto',
        network: 'eip155:8453',
        payTo: payeeAddress,
        asset: USDC_BASE_MAINNET,
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
