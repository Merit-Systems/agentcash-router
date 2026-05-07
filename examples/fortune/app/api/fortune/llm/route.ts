import { z } from 'zod';
import { router } from '@/lib/router';

/**
 * Handler-driven dynamic pricing — the route bills per token of work performed,
 * capped at `maxPrice`. One token = one tick of `tickCost` USDC.
 *
 * Works on both:
 *   - x402 `upto` (the running tick total threads through to
 *     `server.settlePayment(..., { amount: ticks * tickCost })`; Permit2Proxy
 *     enforces `actual ≤ permitted.amount` on chain)
 *   - MPP sessions  (each `charge()` call debits one tick from the channel
 *     voucher; the channel persists across requests for repeat callers)
 *
 * The handler-author writes the same code for both. The 402 challenge
 * advertises the cap and the protocol the client should sign for; the wallet
 * picks the right credential type and the router picks the right wire shape.
 *
 * Test (no auth → 402 challenge with the cap and protocol options):
 *   curl -i -X POST http://localhost:3000/api/fortune/llm \
 *     -H "Content-Type: application/json" \
 *     -d '{"prompt": "Will I be successful?"}'
 *
 * With agentcash CLI (handles the 402 → sign → retry loop):
 *   agentcash fetch http://localhost:3000/api/fortune/llm \
 *     --method POST \
 *     --body '{"prompt": "Will I be successful?"}'
 */
const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

// Simulated LLM that emits output tokens one at a time. Real integration would
// iterate over the model's streaming response and yield each chunk as it
// arrives; usage falls out of the loop count.
async function* simulateLlm(): AsyncGenerator<string> {
  const fortunes = [
    'The future is brighter than your screen.',
    'A stranger will give you advice. Take it.',
    'Patience now will repay you tenfold next month.',
    'Today is the day. Probably.',
  ];
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)]!;
  // Rough proxy for tokens: 1 token ≈ 4 chars of output.
  for (let i = 0; i < fortune.length; i += 4) {
    yield fortune.slice(i, i + 4);
  }
}

export const POST = router
  .route('fortune/llm')
  .description('Dynamic-priced fortune — billed by simulated token usage, capped at maxPrice')
  .paid({ dynamic: true, tickCost: '0.0005', unitType: 'token', maxPrice: '0.10' })
  .body(LlmSchema)
  .handler(async ({ charge, wallet }) => {
    // Charge once per emitted token. If the model errors mid-stream, the
    // partial output is returned and only the tokens we actually emitted are
    // billed — break or return early to skip the rest for free.
    let fortune = '';
    let tokens = 0;
    for await (const token of simulateLlm()) {
      await charge();
      fortune += token;
      tokens += 1;
    }

    return {
      fortune,
      tokens,
      wallet,
      timestamp: new Date().toISOString(),
    };
  });
