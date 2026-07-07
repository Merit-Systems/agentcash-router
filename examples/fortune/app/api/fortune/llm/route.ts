import { z } from 'zod';
import { router } from '@/lib/router';

// Tests MPP session request-mode — one tick committed per request at
// credential verify. Handler returns a value (not a generator), so there
// is no `charge()` callback. For x402 single-settle billing, see
// `/api/fortune/premium`, which uses `.upTo()` and calls
// `charge(amount)` from the handler.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune/llm \
//     --method POST -p mpp -b '{"prompt":"Will I find love?"}'

const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

export const POST = router
  .route('fortune/llm')
  .description('Request-mode session fortune — bills unitCost per request via MPP session')
  .session({
    unitCost: '0.001',
    maxPrice: '0.01',
    unitType: 'request',
    protocols: ['mpp'],
  })
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
