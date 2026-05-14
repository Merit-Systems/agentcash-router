import { z } from 'zod';
import { router } from '@/lib/router';

// Tests MPP session request-mode and x402 upto — one tick committed per
// request at credential verify. Handler returns a value (not a generator),
// so there is no `charge()` callback.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune/llm \
//     --method POST -p mpp -b '{"prompt":"Will I find love?"}'   # MPP session request-mode
//   agentcash fetch http://localhost:3000/api/fortune/llm \
//     --method POST -p x402 -b '{"prompt":"Will I find love?"}'  # x402 upto (one tick)

const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

export const POST = router
  .route('fortune/llm')
  .description('Request-mode dynamic-priced fortune — bills tickCost per request')
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
