import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOLANA_FACILITATOR_URL,
  getAcceptsHeadersForFacilitator,
  getResolvedX402Facilitator,
  getResolvedX402Facilitators,
  getResolvedX402FacilitatorGroups,
} from '../src/x402-facilitators.js';
import type { RouterConfig } from '../src/types.js';

const DEFAULT_CDP_FACILITATOR = 'https://x402.coinbase.com/facilitator';
const BASE_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

function makeConfig(overrides: Partial<RouterConfig> = {}): RouterConfig {
  return {
    payeeAddress: '0x1234567890123456789012345678901234567890',
    baseUrl: 'https://api.example.com',
    discovery: {
      title: 'Test API',
      version: '1.0.0',
    },
    x402: {
      accepts: [
        { network: BASE_NETWORK, payTo: '0x1234567890123456789012345678901234567890' },
        { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
      ],
    },
    ...overrides,
  };
}

describe('x402 facilitator resolution', () => {
  it('defaults Base to CDP and Solana to Corbits', () => {
    const config = makeConfig();

    expect(getResolvedX402Facilitator(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'evm',
      network: BASE_NETWORK,
      url: DEFAULT_CDP_FACILITATOR,
      config: {
        url: DEFAULT_CDP_FACILITATOR,
      },
    });
    expect(getResolvedX402Facilitator(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'solana',
      network: SOLANA_NETWORK,
      url: DEFAULT_SOLANA_FACILITATOR_URL,
      config: {
        url: DEFAULT_SOLANA_FACILITATOR_URL,
      },
    });
  });

  it('keeps legacy facilitatorUrl as the global fallback', () => {
    const config = makeConfig({
      facilitatorUrl: 'https://legacy.example',
    });

    expect(getResolvedX402Facilitator(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'evm',
      network: BASE_NETWORK,
      url: 'https://legacy.example',
      config: {
        url: 'https://legacy.example',
      },
    });
    expect(getResolvedX402Facilitator(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'solana',
      network: SOLANA_NETWORK,
      url: 'https://legacy.example',
      config: {
        url: 'https://legacy.example',
      },
    });
  });

  it('lets Solana override independently while Base stays on CDP by default', () => {
    const config = makeConfig({
      x402: {
        accepts: [
          { network: BASE_NETWORK, payTo: '0x1234567890123456789012345678901234567890' },
          { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
        ],
        facilitators: {
          solana: 'https://solana.example',
        },
      },
    });

    const facilitators = getResolvedX402Facilitators(
      config,
      [BASE_NETWORK, SOLANA_NETWORK],
      DEFAULT_CDP_FACILITATOR,
    );

    expect(facilitators[BASE_NETWORK]?.url).toBe(DEFAULT_CDP_FACILITATOR);
    expect(facilitators[SOLANA_NETWORK]?.url).toBe('https://solana.example');
  });

  it('uses accepts-specific auth headers before supported headers', async () => {
    const acceptsHeaders = { authorization: 'Bearer accepts-token' };
    const supportedHeaders = { authorization: 'Bearer supported-token' };
    const config = makeConfig({
      x402: {
        accepts: [
          { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
        ],
        facilitators: {
          solana: {
            url: 'https://solana.example',
            createAcceptsHeaders: async () => acceptsHeaders,
            createAuthHeaders: async () => ({
              verify: {},
              settle: {},
              supported: supportedHeaders,
            }),
          },
        },
      },
    });

    const facilitator = getResolvedX402Facilitator(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR);

    expect(await getAcceptsHeadersForFacilitator(facilitator!)).toEqual(acceptsHeaders);
  });

  it('applies family-specific facilitators before legacy global fallback', () => {
    const config = makeConfig({
      facilitatorUrl: 'https://legacy.example',
      x402: {
        accepts: [
          { network: BASE_NETWORK, payTo: '0x1234567890123456789012345678901234567890' },
          { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
        ],
        facilitators: {
          evm: 'https://evm.example',
          solana: 'https://solana.example',
        },
      },
    });

    expect(getResolvedX402Facilitator(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'evm',
      network: BASE_NETWORK,
      url: 'https://evm.example',
      config: {
        url: 'https://evm.example',
      },
    });
    expect(getResolvedX402Facilitator(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual({
      family: 'solana',
      network: SOLANA_NETWORK,
      url: 'https://solana.example',
      config: {
        url: 'https://solana.example',
      },
    });
  });

  it('groups networks by family and effective facilitator config', () => {
    const config = makeConfig({
      x402: {
        accepts: [
          { network: 'eip155:8453', payTo: '0x1234567890123456789012345678901234567890' },
          { network: 'eip155:1', payTo: '0x1234567890123456789012345678901234567890' },
          { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
        ],
        facilitators: {
          evm: 'https://evm.example',
          solana: 'https://solana.example',
        },
      },
    });

    expect(
      getResolvedX402FacilitatorGroups(
        getResolvedX402Facilitators(
          config,
          ['eip155:8453', 'eip155:1', SOLANA_NETWORK],
          DEFAULT_CDP_FACILITATOR,
        ),
      ),
    ).toEqual([
      {
        family: 'evm',
        config: { url: 'https://evm.example' },
        networks: ['eip155:8453', 'eip155:1'],
      },
      {
        family: 'solana',
        config: { url: 'https://solana.example' },
        networks: [SOLANA_NETWORK],
      },
    ]);
  });
});
