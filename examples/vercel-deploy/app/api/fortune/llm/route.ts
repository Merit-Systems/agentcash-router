import { z } from 'zod';
import { mppEnabled, router } from '@/lib/router';

// MPP session, request-mode — one tick committed per request at credential verify.
//   agentcash fetch <origin>/api/fortune/llm --method POST -p mpp -b '{"prompt":"Will I find love?"}'
//
// `.metered()` requires MPP session mode, which auto-enables when MPP_OPERATOR_KEY
// is set. When it isn't, registering this route would throw at module load and
// break `next build`. The branch below keeps the route file harmless until MPP
// is configured.

const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const FORTUNES = [
  'The future is brighter than your screen.',
  'A stranger will give you advice. Take it.',
  'Patience now will repay you tenfold next month.',
  'Today is the day. Probably.',
];

export const POST = mppEnabled
  ? router
      .route('fortune/llm')
      .description('Request-mode metered fortune — bills tickCost per request via MPP session')
      .metered({
        tickCost: '0.001',
        maxPrice: '0.01',
        unitType: 'request',
        protocols: ['mpp'],
      })
      .body(LlmSchema)
      .handler(async ({ wallet }) => ({
        fortune: FORTUNES[Math.floor(Math.random() * FORTUNES.length)]!,
        wallet,
        timestamp: new Date().toISOString(),
      }))
  : async () =>
      new Response(
        JSON.stringify({
          error: 'MPP not configured',
          hint: 'Set MPP_OPERATOR_KEY in your Vercel environment and redeploy. See examples/vercel-deploy/README.md#enabling-mpp.',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
