import { z } from 'zod';
import { router } from '@/lib/router';

/**
 * Streaming MPP session route — the handler is an `async function*` and
 * yields response chunks as it produces them. Billing is driven entirely by
 * the handler's `charge()` calls: each call reserves one tick of voucher
 * headroom from the session channel. Yields are pure data flow — they do
 * *not* auto-bill. Skip `charge()` and the corresponding chunk is free.
 *
 * Restricted to MPP because x402 has no streaming primitive. The 402
 * challenge advertises only `intent="session"` for this route.
 *
 * The session channel persists across requests — the same client can call
 * this endpoint many times in a row without re-opening the channel; mppx
 * cycles vouchers transparently and only goes on chain at channel close.
 *
 * Test with agentcash CLI:
 *   agentcash fetch http://localhost:3000/api/fortune/stream \
 *     --method POST \
 *     --body '{"prompt": "Tell me my future"}' \
 *     --stream
 */
const StreamSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const FORTUNE_TOKENS = [
  'A',
  'fortunate',
  'turn',
  'awaits',
  'you',
  'on',
  'the',
  'next',
  'block.',
];

export const POST = router
  .route('fortune/stream')
  .description('Streaming fortune — bills per yielded token via MPP session vouchers')
  .paid({
    dynamic: true,
    tickCost: '0.0001',
    unitType: 'token',
    maxPrice: '0.05',
    protocols: ['mpp'],
  })
  .body(StreamSchema)
  .stream(async function* ({ body, charge }) {
    // Echo the prompt as the first event — bill one token. If the channel
    // runs short, this `await` blocks: mppx emits `payment-need-voucher` and
    // resumes once the client signs a higher cumulative voucher.
    await charge();
    yield JSON.stringify({ event: 'prompt', value: body.prompt });

    for (const token of FORTUNE_TOKENS) {
      await charge();
      yield JSON.stringify({ event: 'token', value: token });

      // Simulate streaming latency.
      await new Promise((r) => setTimeout(r, 50));
    }

    // Trailing `done` event ships free — pure status, no charge() before it.
    yield JSON.stringify({ event: 'done', timestamp: new Date().toISOString() });
  });
