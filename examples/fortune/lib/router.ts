import { createRouterFromEnv } from '@agentcash/router';

export const router = createRouterFromEnv({
  title: 'Fortune API',
  description: 'Pay-per-call fortune telling API',
  guidance:
    'POST /api/fortune for a single fortune ($0.001, x402 exact or MPP one-shot). ' +
    'POST /api/fortune/premium for an x402 upto dynamic-priced reading. ' +
    'POST /api/fortune/llm for MPP session request-mode or x402 upto. ' +
    'POST /api/fortune/stream for an MPP session SSE stream. ' +
    'POST /api/fortune/dynamic for function-based dynamic pricing. ' +
    'GET /api/fortune/profile and POST /api/fortune/favorites are SIWX (identity, no payment).',
});
