import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRouter } from '../src/index.js';
import type { RouterConfig } from '../src/types.js';

const baseConfig: RouterConfig = {
  payeeAddress: '0x1234567890123456789012345678901234567890',
  baseUrl: 'http://localhost:3000',
  network: 'eip155:8453',
  discovery: { title: 'Test API', version: '1.0.0' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('prices deprecation warning', () => {
  it('warns once at createRouter when a prices map is passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRouter({ ...baseConfig, prices: { search: '0.01' } });
    const deprecationWarns = warn.mock.calls.filter(([msg]) =>
      String(msg).includes('RouterConfig.prices is deprecated'),
    );
    expect(deprecationWarns).toHaveLength(1);
  });

  it('warns for an empty prices map too (it does nothing — remove it)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRouter({ ...baseConfig, prices: {} });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
  });

  it('does not warn without a prices map', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRouter(baseConfig);
    const deprecationWarns = warn.mock.calls.filter(([msg]) =>
      String(msg).includes('RouterConfig.prices is deprecated'),
    );
    expect(deprecationWarns).toHaveLength(0);
  });

  it('deprecated prices map still auto-prices and validates (until removal)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, prices: { search: '0.01', missing: '0.02' } });
    router.route('search').handler(async () => ({}));

    const entry = router.registry.get('search');
    expect(entry?.authMode).toBe('paid');
    expect(entry?.pricing).toBe('0.01');

    // Barrel validation still fires for prices keys during the deprecation window.
    await expect(
      router.openapi()(new Request('http://localhost:3000/openapi.json')),
    ).rejects.toThrow(/'missing' in prices map but not registered/);
  });
});
