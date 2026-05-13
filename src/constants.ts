/** Base mainnet CAIP-2 network ID (`eip155:8453`). */
export const BASE_NETWORK = 'eip155:8453';
/** Solana mainnet CAIP-2 network ID. */
export const SOLANA_MAINNET_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
/** Tempo USDC currency address (an EVM-shaped string used to identify the asset on Tempo). */
export const TEMPO_USDC_CURRENCY = '0x20c000000000000000000000b9537d11c60e8b50';
/** All-zeros EVM address. Used as a placeholder/sentinel; not a valid payee. */
export const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
/** Public Solana x402 facilitator. Override per-deployment via `SOLANA_FACILITATOR_URL`. */
export const DEFAULT_SOLANA_FACILITATOR_URL = 'https://facilitator.corbits.dev';
/** USDC contract on Base mainnet. */
export const BASE_USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
/** USDC has 6 decimals on Base. */
export const BASE_USDC_DECIMALS = 6;
