import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'Fortune API',
  description: 'Pay-per-call fortune telling API',
  guidance:
    'POST /api/fortune for a single fortune ($0.001). ' +
    'POST /api/fortune/premium for a longer reading ($0.005). ' +
    'POST /api/fortune/llm and /api/fortune/stream use MPP session-mode dynamic pricing.',
  prices: {
    fortune: '0.001',
    'fortune/premium': '0.005',
  },
});
