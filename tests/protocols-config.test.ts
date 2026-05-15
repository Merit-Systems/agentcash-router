import { describe, it, expect, vi } from 'vitest';
import { TEMPO_USDC_ADDRESS, createRouter } from '../src/index.js';
import { evmAddressFromKey } from '../src/config/utils.js';
import type { RouterConfig } from '../src/types.js';

describe('RouterConfig.protocols', () => {
  const baseConfig: RouterConfig = {
    payeeAddress: '0x1234567890123456789012345678901234567890',
    baseUrl: 'http://localhost:3000',
    network: 'eip155:8453',
    prices: { 'test/route': '0.01' },
  };

  const validMppConfig = {
    secretKey: 'test-secret-key',
    currency: TEMPO_USDC_ADDRESS,
    rpcUrl: 'https://rpc.example.com',
  };

  const sessionOperatorKey = `0x${'1'.repeat(64)}`;
  const sessionOperatorAddress = evmAddressFromKey(sessionOperatorKey)!;

  describe('defaults and basic behavior', () => {
    it('defaults to x402-only when protocols is omitted', () => {
      const router = createRouter(baseConfig);
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['x402']);
    });

    it('applies protocols to auto-priced routes', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['x402', 'mpp'],
        mpp: validMppConfig,
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['x402', 'mpp']);
    });

    it('accepts mpp-only configuration', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['mpp'],
        mpp: validMppConfig,
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['mpp']);
    });

    it('accepts x402-only explicit configuration', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['x402'],
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['x402']);
    });

    it('accepts additive multi-network x402 config', () => {
      const router = createRouter({
        ...baseConfig,
        x402: {
          accepts: [
            { network: 'eip155:8453' },
            {
              network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
              payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2',
            },
          ],
        },
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['x402']);
    });
  });

  describe('validation', () => {
    // protocols: [] always throws (programming error). Every other config
    // error throws at construction too, regardless of NODE_ENV — a
    // misconfiguration fails the build instead of surfacing at request time.

    it('throws when protocols is empty array', () => {
      expect(() => {
        createRouter({ ...baseConfig, protocols: [] });
      }).toThrow(/cannot be empty/);
    });

    it('throws in production when mpp config is missing', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({ ...baseConfig, baseUrl: 'https://test.example.com', protocols: ['mpp'] });
        }).toThrow(/mpp config is missing/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });

    it('throws in production when TEMPO_RPC_URL is missing', () => {
      const origEnv = process.env.NODE_ENV;
      const origRpc = process.env.TEMPO_RPC_URL;
      process.env.NODE_ENV = 'production';
      delete process.env.TEMPO_RPC_URL;
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({
            ...baseConfig,
            baseUrl: 'https://test.example.com',
            protocols: ['mpp'],
            mpp: { secretKey: 'test', currency: TEMPO_USDC_ADDRESS },
          });
        }).toThrow(/Tempo RPC URL/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
        if (origRpc !== undefined) process.env.TEMPO_RPC_URL = origRpc;
      }
    });

    it('reads CDP keys from process.env (not an empty object) for the precheck', () => {
      const origEnv = process.env.NODE_ENV;
      const origId = process.env.CDP_API_KEY_ID;
      const origSecret = process.env.CDP_API_KEY_SECRET;
      process.env.NODE_ENV = 'production';
      process.env.CDP_API_KEY_ID = 'id';
      process.env.CDP_API_KEY_SECRET = 'secret';
      try {
        expect(() =>
          createRouter({ ...baseConfig, baseUrl: 'https://test.example.com' }),
        ).not.toThrow();
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origId !== undefined) process.env.CDP_API_KEY_ID = origId;
        else delete process.env.CDP_API_KEY_ID;
        if (origSecret !== undefined) process.env.CDP_API_KEY_SECRET = origSecret;
        else delete process.env.CDP_API_KEY_SECRET;
      }
    });

    it('throws in production when x402 payeeAddress is missing', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({
            baseUrl: 'https://test.example.com',
            protocols: ['x402'],
          } as RouterConfig);
        }).toThrow(/payeeAddress/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });

    it('throws in production when a non-exact x402 accept is missing asset', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({
            ...baseConfig,
            baseUrl: 'https://test.example.com',
            x402: {
              accepts: [
                {
                  scheme: '@faremeter/x-solana-settlement',
                  network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
                  payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2',
                },
              ],
            },
          });
        }).toThrow(/non-exact x402 accepts require an asset/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });

    it('throws in production when an x402 accept uses an unsupported network', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({
            ...baseConfig,
            baseUrl: 'https://test.example.com',
            x402: {
              accepts: [
                {
                  network: 'cosmos:osmosis-1',
                  payTo: 'osmo1deadbeefdeadbeefdeadbeefdeadbeefdeadbe',
                },
              ],
            },
          });
        }).toThrow(/unsupported x402 network 'cosmos:osmosis-1'/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });

    it('throws in development when mpp config is missing', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        expect(() => createRouter({ ...baseConfig, protocols: ['mpp'] })).toThrow(
          /mpp config is missing/,
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('throws in development when a Tempo RPC URL is configured nowhere', () => {
      const origEnv = process.env.NODE_ENV;
      const origRpc = process.env.TEMPO_RPC_URL;
      process.env.NODE_ENV = 'development';
      delete process.env.TEMPO_RPC_URL;
      try {
        expect(() =>
          createRouter({
            ...baseConfig,
            protocols: ['mpp'],
            mpp: { secretKey: 'test', currency: TEMPO_USDC_ADDRESS },
          }),
        ).toThrow(/Tempo RPC URL/);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origRpc !== undefined) process.env.TEMPO_RPC_URL = origRpc;
      }
    });

    it('throws in development when mpp has no recipient and no payeeAddress', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        expect(() =>
          createRouter({
            baseUrl: 'http://localhost:3000',
            network: 'eip155:8453',
            protocols: ['mpp'],
            mpp: {
              secretKey: 'test',
              currency: TEMPO_USDC_ADDRESS,
              rpcUrl: 'https://rpc.example.com',
            },
          } as RouterConfig),
        ).toThrow(/recipient address/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('throws in development when an x402 accept uses an unsupported network', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        expect(() =>
          createRouter({
            ...baseConfig,
            x402: {
              accepts: [
                {
                  network: 'cosmos:osmosis-1',
                  payTo: 'osmo1deadbeefdeadbeefdeadbeefdeadbeefdeadbe',
                },
              ],
            },
          }),
        ).toThrow(/unsupported x402 network 'cosmos:osmosis-1'/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('throws when an mpp session operatorKey does not match the recipient', () => {
      expect(() =>
        createRouter({
          ...baseConfig,
          protocols: ['mpp'],
          mpp: {
            ...validMppConfig,
            recipient: baseConfig.payeeAddress,
            operatorKey: sessionOperatorKey,
            session: {},
          },
        }),
      ).toThrow(/must equal[\s\S]*recipient/);
    });

    it('accepts mpp config with rpcUrl from env var', () => {
      const original = process.env.TEMPO_RPC_URL;
      process.env.TEMPO_RPC_URL = 'https://rpc.example.com';
      try {
        const router = createRouter({
          ...baseConfig,
          protocols: ['mpp'],
          mpp: { secretKey: 'test', currency: TEMPO_USDC_ADDRESS },
        });
        router.route('test/route').handler(async () => ({}));
        const entry = router.registry.get('test/route');
        expect(entry!.protocols).toEqual(['mpp']);
      } finally {
        if (original !== undefined) {
          process.env.TEMPO_RPC_URL = original;
        } else {
          delete process.env.TEMPO_RPC_URL;
        }
      }
    });
  });

  describe('metered route session requirements', () => {
    it('throws when a .metered() route is defined with mpp.session but no operatorKey', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['mpp'],
        mpp: {
          ...validMppConfig,
          recipient: baseConfig.payeeAddress,
          session: {},
        },
      });
      expect(() =>
        router
          .route('metered/route')
          .metered({ maxPrice: '0.05', tickCost: '0.0001', protocols: ['mpp'] })
          .handler(async () => ({})),
      ).toThrow(/requires MPP session mode/);
    });

    it('registers a .metered() route when mpp.session and operatorKey are both set', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['mpp'],
        mpp: {
          ...validMppConfig,
          recipient: sessionOperatorAddress,
          operatorKey: sessionOperatorKey,
          session: {},
        },
      });
      router
        .route('metered/route')
        .metered({ maxPrice: '0.05', tickCost: '0.0001', protocols: ['mpp'] })
        .handler(async () => ({}));
      expect(router.registry.get('metered/route')).toBeDefined();
    });
  });

  describe('interaction with manual pricing', () => {
    it('does not affect manually-priced routes', () => {
      const router = createRouter({
        payeeAddress: '0x1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:3000',
        protocols: ['x402'],
      });

      router
        .route('manual')
        .paid('0.05', { protocols: ['mpp'] })
        .handler(async () => ({}));

      const entry = router.registry.get('manual');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['mpp']); // Manual config wins
    });

    it('manual routes can override global protocols', () => {
      const router = createRouter({
        payeeAddress: '0x1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:3000',
        protocols: ['x402', 'mpp'],
        mpp: validMppConfig,
        prices: { 'auto/route': '0.01' },
      });

      router.route('auto/route').handler(async () => ({}));
      router
        .route('manual/route')
        .paid('0.02', { protocols: ['x402'] })
        .handler(async () => ({}));

      const autoEntry = router.registry.get('auto/route');
      const manualEntry = router.registry.get('manual/route');

      expect(autoEntry!.protocols).toEqual(['x402', 'mpp']);
      expect(manualEntry!.protocols).toEqual(['x402']);
    });
  });

  describe('multiple auto-priced routes', () => {
    it('applies protocols to all auto-priced routes', () => {
      const router = createRouter({
        payeeAddress: '0x1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:3000',
        protocols: ['x402', 'mpp'],
        mpp: validMppConfig,
        prices: {
          'route/one': '0.01',
          'route/two': '0.02',
          'route/three': '0.03',
        },
      });

      router.route('route/one').handler(async () => ({}));
      router.route('route/two').handler(async () => ({}));
      router.route('route/three').handler(async () => ({}));

      const entry1 = router.registry.get('route/one');
      const entry2 = router.registry.get('route/two');
      const entry3 = router.registry.get('route/three');

      expect(entry1!.protocols).toEqual(['x402', 'mpp']);
      expect(entry2!.protocols).toEqual(['x402', 'mpp']);
      expect(entry3!.protocols).toEqual(['x402', 'mpp']);
    });
  });

  describe('mpp config with recipient', () => {
    it('accepts mpp config with custom recipient', () => {
      const router = createRouter({
        ...baseConfig,
        protocols: ['mpp'],
        mpp: {
          secretKey: 'test',
          currency: TEMPO_USDC_ADDRESS,
          recipient: '0x9876543210987654321098765432109876543210',
          rpcUrl: 'https://rpc.example.com',
        },
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry!.protocols).toEqual(['mpp']);
    });
  });
});
