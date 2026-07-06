// Type-level regression tests for createRouter price-key inference —
// typechecked by vitest (never executed). Guards the ExtractPriceKeys
// conditional against regressions for configs declared as plain RouterConfig.
import { describe, it } from 'vitest';
import type { RouterConfig } from '../src/types.js';
import { createRouter } from '../src/index.js';

const routerConfig: RouterConfig = {
  baseUrl: 'https://api.example.com',
  protocols: ['x402'],
  payeeAddress: '0x1111111111111111111111111111111111111111',
  discovery: {
    title: 'Test API',
    version: '1.0.0',
    description: 'Test',
    guidance: 'Test guidance',
  },
};

describe('createRouter price-key inference', () => {
  it('keeps routes unpriced (so .paid() typechecks) when the config has no prices map', () => {
    const router = createRouter(routerConfig);
    router
      .route('search')
      .paid('0.01')
      .handler(async () => ({ ok: true }));
  });

  it('pre-prices routes named in the prices map (so .handler() typechecks directly)', () => {
    const pricedRouter = createRouter({
      ...routerConfig,
      prices: { search: '0.01' },
    });
    pricedRouter.route('search').handler(async () => ({ ok: true }));
  });
});
