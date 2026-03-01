import { describe, expect, it } from 'vitest';
import { createRouter } from '../src/index.js';
import { z } from 'zod';

const baseConfig = {
  payeeAddress: '0x1111111111111111111111111111111111111111',
  baseUrl: 'https://api.example.com',
};

describe('route definitions', () => {
  it('normalizes path-first definitions and applies explicit method', () => {
    const router = createRouter(baseConfig);
    router
      .route({ path: '/api/jobs/{id}/', method: 'DELETE' })
      .paid('0.01')
      .body(z.object({}))
      .handler(async () => ({ ok: true }));

    const entry = router.registry.get('jobs/{id}');
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('jobs/{id}');
    expect(entry?.method).toBe('DELETE');
  });

  it('applies prices map when key defaults to path', () => {
    const router = createRouter({
      ...baseConfig,
      prices: { 'search/query': '0.05' },
    });

    router
      .route({ path: 'search/query' })
      .body(z.object({}))
      .handler(async () => ({ ok: true }));

    const entry = router.registry.get('search/query');
    expect(entry?.authMode).toBe('paid');
    expect(entry?.pricing).toBe('0.05');
  });

  it('strictRoutes rejects string form', () => {
    const router = createRouter({
      ...baseConfig,
      strictRoutes: true,
    });

    expect(() => router.route('legacy/key')).toThrow(
      'strictRoutes=true requires route({ path }) form',
    );
  });

  it('strictRoutes rejects custom key/path divergence', () => {
    const router = createRouter({
      ...baseConfig,
      strictRoutes: true,
    });

    expect(() => router.route({ path: 'public/path', key: 'legacy/key' })).toThrow(
      'strictRoutes=true forbids key/path divergence',
    );
  });
});
