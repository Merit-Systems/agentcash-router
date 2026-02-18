import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createRouter } from '../src/index.js';
import type { RouterConfig } from '../src/types.js';

describe('RouterConfig.protocols', () => {
  const baseConfig: RouterConfig = {
    payeeAddress: '0x1234567890123456789012345678901234567890',
    network: 'eip155:8453',
    prices: { 'test/route': '0.01' },
  };

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
        mpp: { secretKey: 'test-secret-key', currency: 'USDC' },
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
        mpp: { secretKey: 'test-secret-key', currency: 'USDC' },
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
  });

  describe('validation', () => {
    // Config validation is deferred to first request so that createRouter()
    // stays side-effect-free and doesn't throw during `next build`.

    it('throws on first request when protocols is empty array', async () => {
      const router = createRouter({ ...baseConfig, protocols: [] });
      const handler = router
        .route('test/route')
        .unprotected()
        .handler(async () => ({}));
      await expect(handler(new NextRequest('http://localhost/api/test'))).rejects.toThrow(
        /cannot be empty/,
      );
    });

    it('throws on first request when protocols includes mpp without mpp config', async () => {
      const router = createRouter({ ...baseConfig, protocols: ['mpp'] });
      const handler = router
        .route('test/route')
        .unprotected()
        .handler(async () => ({}));
      await expect(handler(new NextRequest('http://localhost/api/test'))).rejects.toThrow(
        /mpp is not configured/,
      );
    });

    it('throws on first request when protocols includes both but mpp config missing', async () => {
      const router = createRouter({ ...baseConfig, protocols: ['x402', 'mpp'] });
      const handler = router
        .route('test/route')
        .unprotected()
        .handler(async () => ({}));
      await expect(handler(new NextRequest('http://localhost/api/test'))).rejects.toThrow(
        /mpp is not configured/,
      );
    });

    it('throws on first request when protocols includes x402 without payeeAddress', async () => {
      const configWithoutPayee = {
        network: 'eip155:8453',
        prices: { 'test/route': '0.01' },
        protocols: ['x402'] as const,
      };
      const router = createRouter(configWithoutPayee as RouterConfig);
      const handler = router
        .route('test/route')
        .unprotected()
        .handler(async () => ({}));
      await expect(handler(new NextRequest('http://localhost/api/test'))).rejects.toThrow(
        /payeeAddress is not configured/,
      );
    });
  });

  describe('interaction with manual pricing', () => {
    it('does not affect manually-priced routes', () => {
      const router = createRouter({
        payeeAddress: '0x1234567890123456789012345678901234567890',
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
        protocols: ['x402', 'mpp'],
        mpp: { secretKey: 'test', currency: 'USDC' },
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
        protocols: ['x402', 'mpp'],
        mpp: { secretKey: 'test', currency: 'USDC' },
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
          currency: 'USDC',
          recipient: '0xCustomRecipient',
        },
      });
      router.route('test/route').handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry!.protocols).toEqual(['mpp']);
    });
  });
});
