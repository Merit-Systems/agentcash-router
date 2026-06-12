// @agentcash/router on a plain Hono + Node server. The router core is
// framework-agnostic (Web-standard Request/Response): `router.hono()` exposes
// the internal Hono app, which serves every registered route at
// `/api/{path}` plus the discovery surfaces (`/.well-known/x402`,
// `/openapi.json`, `/llms.txt`). The same app works on any fetch runtime
// (Bun, Deno, Cloudflare Workers) via `router.fetch`.
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createRouterFromEnv } from '@agentcash/router';
import { z } from 'zod';

const router = createRouterFromEnv({
  title: 'Quote API',
  description: 'Pay-per-call quotes, served from a plain Hono server.',
  guidance:
    'GET /api/health is free. POST /api/quote with { topic } returns a quote for $0.001.',
});

const QUOTES: Record<string, string[]> = {
  wisdom: [
    'The obstacle is the way.',
    'Slow is smooth, smooth is fast.',
    'You do not rise to the level of your goals; you fall to the level of your systems.',
  ],
  code: [
    'Make it work, make it right, make it fast.',
    'Deleted code is debugged code.',
    'A good API is hard to misuse.',
  ],
};

// Paid: $0.001 per quote, settled via x402 (or MPP when configured).
router
  .route('quote')
  .paid('0.001')
  .body(z.object({ topic: z.enum(['wisdom', 'code']).default('wisdom') }))
  .description('Random quote for a topic')
  .handler(async ({ body }) => {
    const options = QUOTES[body.topic];
    return {
      topic: body.topic,
      quote: options[Math.floor(Math.random() * options.length)],
    };
  });

// Free liveness probe, with a `.nextStep()` edge: successful responses carry a
// `next` array pointing agents at the paid route.
router
  .route({ path: 'health', method: 'GET' })
  .unprotected()
  .description('Liveness probe')
  .nextStep({
    route: 'quote',
    args: () => ({ topic: 'wisdom' }),
    note: 'Get a quote for $0.001.',
  })
  .handler(async () => ({ ok: true }));

// Mount into a larger Hono app (add your own middleware/routes alongside).
const app = new Hono();
app.route('/', router.hono());

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(
  `Quote API on http://localhost:${port} — try GET /api/health, discovery at /llms.txt`,
);
