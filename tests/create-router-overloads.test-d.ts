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

const router = createRouter(routerConfig);

router
  .route('search')
  .paid('0.01')
  .handler(async () => ({ ok: true }));

const pricedRouter = createRouter({
  ...routerConfig,
  prices: { search: '0.01' },
});

pricedRouter.route('search').handler(async () => ({ ok: true }));
