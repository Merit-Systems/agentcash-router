import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOLANA_FACILITATOR_URL,
  getResolvedX402FacilitatorConfig,
  getResolvedX402FacilitatorGroups,
  getResolvedX402FacilitatorUrls,
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

    expect(getResolvedX402FacilitatorConfig(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual(
      {
        url: DEFAULT_CDP_FACILITATOR,
      },
    );
    expect(
      getResolvedX402FacilitatorConfig(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR),
    ).toEqual({
      url: DEFAULT_SOLANA_FACILITATOR_URL,
    });
  });

  it('keeps legacy facilitatorUrl as the global fallback', () => {
    const config = makeConfig({
      facilitatorUrl: 'https://legacy.example',
    });

    expect(getResolvedX402FacilitatorConfig(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual(
      {
        url: 'https://legacy.example',
      },
    );
    expect(
      getResolvedX402FacilitatorConfig(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR),
    ).toEqual({
      url: 'https://legacy.example',
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

    const urls = getResolvedX402FacilitatorUrls(
      config,
      [BASE_NETWORK, SOLANA_NETWORK],
      DEFAULT_CDP_FACILITATOR,
    );

    expect(urls).toEqual({
      [BASE_NETWORK]: DEFAULT_CDP_FACILITATOR,
      [SOLANA_NETWORK]: 'https://solana.example',
    });
  });

  it('applies network-specific overrides before family and legacy fallbacks', () => {
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
          networks: {
            [SOLANA_NETWORK]: 'https://solana-network.example',
          },
        },
      },
    });

    expect(getResolvedX402FacilitatorConfig(config, BASE_NETWORK, DEFAULT_CDP_FACILITATOR)).toEqual(
      {
        url: 'https://evm.example',
      },
    );
    expect(
      getResolvedX402FacilitatorConfig(config, SOLANA_NETWORK, DEFAULT_CDP_FACILITATOR),
    ).toEqual({
      url: 'https://solana-network.example',
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
        config,
        ['eip155:8453', 'eip155:1', SOLANA_NETWORK],
        DEFAULT_CDP_FACILITATOR,
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
