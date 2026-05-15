import { z } from 'zod';
import { router } from '@/lib/router';

// Tests MPP session SSE streaming — the handler is an async generator and
// each `charge()` call reserves one voucher tick from the session channel.
// Restricted to MPP because x402 has no streaming primitive.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune/stream \
//     --method POST -b '{"prompt":"What awaits me?"}' --stream

const StreamSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const FORTUNE_TOKENS = ['A', 'fortunate', 'turn', 'awaits', 'you', 'on', 'the', 'next', 'block.'];

export const POST = router
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
  });
