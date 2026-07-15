// Type-level tests for the X402Network CAIP-2 constraint — typechecked by
// vitest (never executed). An unused `@ts-expect-error` fails the suite.
import { describe, it } from 'vitest';
import { BASE_MAINNET_NETWORK, SOLANA_MAINNET_NETWORK } from '../src/constants.js';
import type { DiscoveryConfig, RouterConfig, X402AcceptConfig } from '../src/types.js';

declare const discovery: DiscoveryConfig;
const base = { baseUrl: 'https://x.test', discovery } satisfies Partial<RouterConfig>;

describe('RouterConfig.network accepts CAIP-2 identifiers only', () => {
  it('accepts the exported constants and raw CAIP-2 strings', () => {
    const _base: RouterConfig = { ...base, network: BASE_MAINNET_NETWORK };
    const _solana: RouterConfig = { ...base, network: SOLANA_MAINNET_NETWORK };
    const _raw: RouterConfig = { ...base, network: 'eip155:84532' };
  });

  it('rejects friendly network names', () => {
    // @ts-expect-error — 'base' is not CAIP-2
    const _base: RouterConfig = { ...base, network: 'base' };
    // @ts-expect-error — 'base-sepolia' is not CAIP-2
    const _sepolia: RouterConfig = { ...base, network: 'base-sepolia' };
  });
});

describe('X402AcceptConfig.network accepts CAIP-2 identifiers only', () => {
  it('accepts CAIP-2 strings', () => {
    const _accept: X402AcceptConfig = { network: 'eip155:8453' };
  });

  it('rejects friendly network names', () => {
    // @ts-expect-error — 'solana-mainnet' is not CAIP-2
    const _accept: X402AcceptConfig = { network: 'solana-mainnet' };
  });
});
