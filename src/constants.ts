/** Base mainnet CAIP-2 network ID (`eip155:8453`). */
export const BASE_MAINNET_NETWORK = 'eip155:8453';
/** Solana mainnet CAIP-2 network ID. */
export const SOLANA_MAINNET_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
/** USDC contract address on Tempo (the `mpp.currency` value for Tempo USDC). */
export const TEMPO_USDC_ADDRESS = '0x20c000000000000000000000b9537d11c60e8b50';
/** USDC has 6 decimals on Tempo. */
export const TEMPO_USDC_DECIMALS = 6;
/** USDC contract on Base mainnet. */
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
/** USDC has 6 decimals on Base. */
export const BASE_USDC_DECIMALS = 6;
/** All-zeros EVM address. Used as a placeholder/sentinel; not a valid payee. */
export const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
/** Public Solana x402 facilitator. Override per-deployment via `SOLANA_FACILITATOR_URL`. */
export const DEFAULT_SOLANA_FACILITATOR_URL = 'https://facilitator.corbits.dev';
/** Public Tempo JSON-RPC endpoint used for MPP on-chain verification. Override per-deployment via `TEMPO_RPC_URL`. */
export const DEFAULT_TEMPO_RPC_URL = 'https://rpc.tempo.xyz';
