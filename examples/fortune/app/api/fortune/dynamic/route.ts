import { z } from 'zod';
import { HttpError } from '@agentcash/router';
import { router } from '@/lib/router';

const DynamicSchema = z.object({
  category: z.enum(['love', 'career', 'health', 'wealth']),
  depth: z.enum(['brief', 'detailed', 'comprehensive']).default('brief'),
});

const pricing: Record<string, number> = {
  brief: 0.01,
  detailed: 0.03,
  comprehensive: 0.05,
};

const fortunes: Record<string, Record<string, string>> = {
  love: {
    brief: 'Love finds you soon.',
    detailed:
      'A meaningful connection is forming. Stay open to unexpected encounters this week.',
    comprehensive:
      'The stars align for romance. Someone from your past may reappear with new intentions. Trust your instincts — they will guide you to the relationship you deserve.',
  },
  career: {
    brief: 'Success is near.',
    detailed: 'Your professional efforts are about to pay off. A key decision awaits.',
    comprehensive:
      'A pivotal career moment approaches. The project you have been nurturing will gain unexpected momentum. Prepare for a conversation that could change your trajectory entirely.',
  },
  health: {
    brief: 'Vitality rises.',
    detailed: 'Your body is ready for a positive change. Small habits will compound.',
    comprehensive:
      'A breakthrough in your wellbeing is imminent. The routine you start this week will have lasting effects. Listen to what your energy levels are telling you.',
  },
  wealth: {
    brief: 'Prosperity beckons.',
    detailed: 'A financial opportunity is closer than you think. Watch for signals.',
    comprehensive:
      'An unexpected source of income will present itself. The investment of time you made months ago is about to yield returns. Stay disciplined with your resources.',
  },
};

const blockedCombos = new Set(['wealth:comprehensive']);

/**
 * Dynamic pricing fortune — mirrors the stablestudio pattern exactly:
 *   .route(key).paid(pricingFn, { maxPrice }).body(schema).handler(fn)
 *
 * - Pricing function does pre-payment validation (HttpError 400) before returning price
 * - Uses .toFixed(2) like stablestudio's calculateJobCostFromRegistry
 * - maxPrice is much higher than any dynamic price (same ratio as stablestudio)
 */
const pricingFn = async (body: Record<string, unknown>) => {
  const depth = (body.depth as string) ?? 'brief';
  const category = body.category as string;

  if (blockedCombos.has(`${category}:${depth}`)) {
    throw new HttpError('Wealth + comprehensive is temporarily unavailable', 400);
  }

  const cost = pricing[depth] ?? pricing.brief;
  return cost.toFixed(2);
};

export const POST = router
  .route('fortune/dynamic')
  .description('Dynamic pricing fortune with pre-payment validation')
  .paid(pricingFn, { maxPrice: '10.00' })
  .body(DynamicSchema)
  .handler(async ({ body, wallet }) => {
    const fortune = fortunes[body.category]?.[body.depth] ?? 'The future is unclear.';

    return {
      fortune,
      category: body.category,
      depth: body.depth,
      price: pricing[body.depth],
      wallet,
      timestamp: new Date().toISOString(),
    };
  });
