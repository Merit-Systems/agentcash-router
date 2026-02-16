import { z } from 'zod';
import { router } from '../../../../lib/router';

const PremiumSchema = z.object({
  category: z.enum(['love', 'career', 'health']),
});

// Simulate category-based rate limits (resets on server restart)
// 'health' is pre-exhausted for testing validate rejection
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

/**
 * Premium fortune endpoint with pre-payment validation.
 *
 * Demonstrates `.validate()` for async business logic that runs BEFORE
 * the 402 challenge is shown. Invalid requests are rejected with appropriate
 * error codes, not charged.
 *
 * Test validate pass (returns 402 with price):
 *   curl -X POST http://localhost:3000/api/fortune/premium \
 *     -H "Content-Type: application/json" \
 *     -d '{"category": "love"}'
 *
 * Test validate fail (returns 429 before price - 'health' is pre-exhausted):
 *   curl -X POST http://localhost:3000/api/fortune/premium \
 *     -H "Content-Type: application/json" \
 *     -d '{"category": "health"}'
 */
export const POST = router
  .route('fortune/premium')
  .paid('0.005')
  .body(PremiumSchema)
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
    // Increment usage
    const count = categoryUsage.get(body.category) ?? 0;
    categoryUsage.set(body.category, count + 1);

    // Get random fortune for category
    const fortunes = premiumFortunes[body.category];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];

    return {
      fortune,
      category: body.category,
      remaining: CATEGORY_LIMIT - (count + 1),
      timestamp: new Date().toISOString(),
    };
  });
