import { z } from 'zod';
import { router } from '@/lib/router';

/**
 * Request-mode dynamic pricing — the route bills exactly `tickCost` per
 * request. The handler returns a value (not a generator) and has no `charge()`
 * callback on its context. The wire commits one tick at credential
 * verification: MPP non-SSE auto-charge on session credentials, or x402
 * `upto` settled for `tickCost` ≤ cap.
 *
 * This is the spec-aligned "discrete paid unit" model. For variable-cost
 * per-request billing (one tick per token), use the streaming sibling at
 * `fortune/stream` — async generators are the only handler shape with a
 * `charge()` callback under this design.
 *
 * Works on both:
 *   - x402 `upto` (settle-amount override = tickCost; Permit2Proxy enforces ≤
 *     permitted.amount on chain)
 *   - MPP sessions (one prepaid tick committed at credential verify; channel
 *     persists across requests for repeat callers)
 *
 * Test (no auth → 402 challenge):
 *   curl -i -X POST http://localhost:3000/api/fortune/llm \
 *     -H "Content-Type: application/json" \
 *     -d '{"prompt": "Will I be successful?"}'
 */
const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

export const POST = router
  .route('fortune/llm')
  .description('Request-mode dynamic-priced fortune — bills tickCost per request')
  // tickCost is what's billed per request ($0.001 each). maxPrice sizes the
  // server's `suggestedDeposit` on the 402 challenge — set high enough so
  // the channel covers many requests on the initial open. mppx 0.6.16 has
  // no auto-topUp in client `SessionManager`; raising the cap up front is
  // the practical workaround.
  .paid({ dynamic: true, tickCost: '0.001', unitType: 'request', maxPrice: '0.01' })
  .body(LlmSchema)
  .handler(async ({ wallet }) => {
    const fortunes = [
      'The future is brighter than your screen.',
      'A stranger will give you advice. Take it.',
      'Patience now will repay you tenfold next month.',
      'Today is the day. Probably.',
    ];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)]!;

    return {
      fortune,
      wallet,
      timestamp: new Date().toISOString(),
    };
  });
