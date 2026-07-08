import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRouter } from '../src/index.js';
import { routerConfigFromEnv } from '../src/config/index.js';
import type { RouterConfig } from '../src/types.js';

const baseConfig: RouterConfig = {
  payeeAddress: '0x1234567890123456789012345678901234567890',
  baseUrl: 'http://localhost:3000',
  network: 'eip155:8453',
  discovery: { title: 'Test API', version: '1.0.0' },
};

const openapiRequest = new Request('http://localhost:3000/openapi.json');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discovery.expectRoutes barrel validation', () => {
  it('discovery rejects when an expected route is not registered', async () => {
    const router = createRouter({
      ...baseConfig,
      discovery: { ...baseConfig.discovery, expectRoutes: ['search', 'missing-route'] },
    });
    router
      .route('search')
      .paid('0.01')
      .handler(async () => ({}));

    await expect(router.openapi()(openapiRequest)).rejects.toThrow(
      /'missing-route' expected but not registered/,
    );
  });

  it('discovery serves once every expected route is registered', async () => {
    const router = createRouter({
      ...baseConfig,
      discovery: { ...baseConfig.discovery, expectRoutes: ['search'] },
    });
    router
      .route('search')
      .paid('0.01')
      .handler(async () => ({}));

    const res = await router.openapi()(openapiRequest);
    expect(res.status).toBe(200);
  });

  it('unions expectRoutes with keys from the deprecated prices map', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({
      ...baseConfig,
      prices: { 'priced-route': '0.01' },
      discovery: { ...baseConfig.discovery, expectRoutes: ['manifest-route'] },
    });
    router
      .route('manifest-route')
      .siwx()
      .handler(async () => ({}));

    // 'priced-route' (from prices) is still expected and missing.
    await expect(router.openapi()(openapiRequest)).rejects.toThrow(
      /'priced-route' expected but not registered/,
    );
  });

  it('no validation when neither expectRoutes nor prices is set', async () => {
    const router = createRouter(baseConfig);
    router
      .route('whatever')
      .paid('0.01')
      .handler(async () => ({}));

    const res = await router.openapi()(openapiRequest);
    expect(res.status).toBe(200);
  });
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
});

describe('createRouterFromEnv expectRoutes passthrough', () => {
  it('maps options.expectRoutes into discovery.expectRoutes', () => {
    const config = routerConfigFromEnv({
      env: {
        BASE_URL: 'http://localhost:3000',
        EVM_PAYEE_ADDRESS: '0x1234567890123456789012345678901234567890',
      },
      title: 'Test API',
      description: 'Pay-per-call test.',
      guidance: 'POST anywhere.',
      expectRoutes: ['search', 'lookup'],
    });
    expect(config.discovery.expectRoutes).toEqual(['search', 'lookup']);
  });
});
