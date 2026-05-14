import { z } from 'zod';
import { router } from '../../../../lib/router';

// Tests x402 upto — handler-driven dynamic pricing settled with EIP-2612
// gas-sponsoring on Base. Also exercises `.validate()` running BEFORE the 402.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune/premium \
//     --method POST -p x402 -b '{"category":"love"}'
//
// To hit the validate-rejection path (category 'health' is pre-exhausted, so
// the request returns 429 before any payment challenge):
//   agentcash fetch http://localhost:3000/api/fortune/premium \
//     --method POST -p x402 -b '{"category":"health"}'

const PremiumSchema = z.object({
  category: z.enum(['love', 'career', 'health']),
});

const categoryUsage = new Map<string, number>([['health', 3]]);
const CATEGORY_LIMIT = 3;

const premiumFortunes: Record<string, string[]> = {
  love: [
    'A romantic surprise awaits you this week.',
    'Your heart will find what it seeks.',
    'Love is closer than you think.',
  ],
  career: [
    'A promotion is on the horizon.',
    'Your hard work will be recognized soon.',
    'New opportunities are coming your way.',
  ],
  health: [
    'Your energy levels will soar.',
    'A healthy habit will transform your life.',
    'Listen to your body — it knows what it needs.',
  ],
};

export const POST = router
  .route('fortune/premium')
  .body(PremiumSchema)
  .paid({
    dynamic: true,
    tickCost: '0.005',
    unitType: 'request',
    maxPrice: '0.05',
    protocols: ['x402'],
  })
  .validate(async (body) => {
    const count = categoryUsage.get(body.category) ?? 0;
    if (count >= CATEGORY_LIMIT) {
      throw Object.assign(
        new Error(`Category '${body.category}' limit reached (${CATEGORY_LIMIT}/day). Try another category.`),
        { status: 429 },
      );
    }
  })
  .description('Premium fortune with category selection (rate limited per category)')
  .handler(async ({ body }) => {
    const count = categoryUsage.get(body.category) ?? 0;
    categoryUsage.set(body.category, count + 1);

    const fortunes = premiumFortunes[body.category];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];

    return {
      fortune,
      category: body.category,
      remaining: CATEGORY_LIMIT - (count + 1),
      timestamp: new Date().toISOString(),
    };
  });
