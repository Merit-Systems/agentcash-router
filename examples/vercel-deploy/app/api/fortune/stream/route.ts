import { z } from 'zod';
import { mppEnabled, router } from '@/lib/router';

// MPP session SSE streaming — async generator handler, each `charge()` reserves
// one voucher tick. MPP-only; x402 has no streaming primitive.
//   agentcash fetch <origin>/api/fortune/stream --method POST -b '{"prompt":"What awaits me?"}' --stream
//
// See `app/api/fortune/llm/route.ts` for the MPP-enabled gate rationale.

const StreamSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const FORTUNE_TOKENS = ['A', 'fortunate', 'turn', 'awaits', 'you', 'on', 'the', 'next', 'block.'];

export const POST = mppEnabled
  ? router
      .route('fortune/stream')
      .description('Streaming fortune — bills per yielded token via MPP session vouchers')
      .metered({
        tickCost: '0.0001',
        maxPrice: '0.05',
        unitType: 'token',
        protocols: ['mpp'],
      })
      .body(StreamSchema)
      .stream(async function* ({ body, charge }) {
        await charge();
        yield JSON.stringify({ event: 'prompt', value: body.prompt });

        for (const token of FORTUNE_TOKENS) {
          await charge();
          yield JSON.stringify({ event: 'token', value: token });
          await new Promise((r) => setTimeout(r, 50));
        }

        yield JSON.stringify({ event: 'done', timestamp: new Date().toISOString() });
      })
  : async () =>
      new Response(
        JSON.stringify({
          error: 'MPP not configured',
          hint: 'Set MPP_OPERATOR_KEY in your Vercel environment and redeploy. See examples/vercel-deploy/README.md#enabling-mpp.',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
