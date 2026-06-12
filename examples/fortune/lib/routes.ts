// All route registrations live in this one module. The catch-all handler
// (`app/api/[[...route]]/route.ts`) and the discovery route files import it
// for its side effects — every `router.route(...)` call below registers the
// route with the router's internal Hono app, which then serves it at
// `/api/{path}`.
import { z } from 'zod';
import { HttpError } from '@agentcash/router';
import { router } from './router';

// ---------------------------------------------------------------------------
// POST /api/fortune — x402 exact and MPP one-shot (same fixed-price route,
// swap the `-p` flag).
//   agentcash fetch http://localhost:3000/api/fortune --method POST -p x402
//   agentcash fetch http://localhost:3000/api/fortune --method POST -p mpp
//
// Also demonstrates `.nextStep()`: successful JSON responses gain a `next`
// array pointing at the premium reading, and the chain shows up in
// `/.well-known/x402` (workflows), `/openapi.json` (links + x-next), and
// `/llms.txt` (## Workflows).
// ---------------------------------------------------------------------------

const fortunes = [
  'A beautiful, smart, and loving person will be coming into your life.',
  'A dubious friend may be an enemy in camouflage.',
  'A feather in the hand is better than a bird in the air.',
  'A fresh start will put you on your way.',
  'A friend asks only for your time not your money.',
  "A gambler not only will lose what he has, but also will lose what he doesn't have.",
  'A golden egg of opportunity falls into your lap this month.',
  'A good friendship is often more important than a passionate romance.',
  'A good time to finish up old tasks.',
  'A lifetime of happiness lies ahead of you.',
];

router
  .route('fortune')
  .paid('0.001')
  .description('Random fortune — fixed price; x402 exact or MPP one-shot')
  .nextStep({
    route: 'fortune/premium',
    args: () => ({ category: 'love' }),
    note: 'Want a deeper reading? Premium fortunes are metered up to $0.005.',
  })
  .handler(async () => ({
    fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
    timestamp: new Date().toISOString(),
  }));

// ---------------------------------------------------------------------------
// POST /api/fortune/premium — x402 upto: handler-driven metered pricing
// settled with EIP-2612 gas-sponsoring on Base. Also exercises `.validate()`
// running BEFORE the 402.
//   agentcash fetch http://localhost:3000/api/fortune/premium \
//     --method POST -p x402 -b '{"category":"love"}'
//
// To hit the validate-rejection path (category 'health' is pre-exhausted, so
// the request returns 429 before any payment challenge):
//   agentcash fetch http://localhost:3000/api/fortune/premium \
//     --method POST -p x402 -b '{"category":"health"}'
// ---------------------------------------------------------------------------

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

router
  .route('fortune/premium')
  .body(PremiumSchema)
  .upTo('0.005')
  .validate(async (body) => {
    const count = categoryUsage.get(body.category) ?? 0;
    if (count >= CATEGORY_LIMIT) {
      throw Object.assign(
        new Error(
          `Category '${body.category}' limit reached (${CATEGORY_LIMIT}/day). Try another category.`,
        ),
        { status: 429 },
      );
    }
  })
  .description('Premium fortune with category selection (rate limited per category)')
  .handler(async ({ body, charge }) => {
    const count = categoryUsage.get(body.category) ?? 0;
    categoryUsage.set(body.category, count + 1);

    const options = premiumFortunes[body.category];
    const amount = (Math.random() * 0.004 + 0.0005).toFixed(6);

    await charge(amount);
    return {
      fortune: options[Math.floor(Math.random() * options.length)],
      category: body.category,
      remaining: CATEGORY_LIMIT - (count + 1),
      timestamp: new Date().toISOString(),
    };
  });

// ---------------------------------------------------------------------------
// GET /api/fortune/profile — SIWX (Sign-In-with-X): verified wallet identity,
// no payment. Supports EVM (Base) and Solana wallets via `x402.accepts`.
//   agentcash fetch http://localhost:3000/api/fortune/profile
// ---------------------------------------------------------------------------

router
  .route('fortune/profile')
  .siwx()
  .method('GET')
  .description('Get verified wallet identity (SIWX, no payment)')
  .handler(async ({ wallet }) => ({
    wallet: wallet!,
    message: 'Identity verified via Sign-In with X',
  }));

// ---------------------------------------------------------------------------
// POST /api/fortune/membership — `.upTo().siwx()`: pay once with x402, then
// replay for free using a SIWX wallet signature. The handler calls
// charge(amount); on the first paid request it accumulates a real settlement
// total, on a SIWX-entitled replay it's a no-op.
//
// First request (pays via x402, settles, grants entitlement to the wallet):
//   agentcash fetch http://localhost:3000/api/fortune/membership --method POST -p x402
//
// Second request from the same wallet (CLI presents a SIWX signature, no payment):
//   agentcash fetch http://localhost:3000/api/fortune/membership --method POST
// ---------------------------------------------------------------------------

const readings = [
  'Mercury favors you — act on your boldest idea this week.',
  'Saturn rewards patience: the door you knocked on once will open quietly.',
  'Mars is restless. Channel that into something physical before it lights you up.',
  'Venus brings someone unexpected into orbit. Listen more than you speak.',
];

router
  .route('fortune/membership')
  .upTo('0.005')
  .siwx()
  .description('Pay once via x402; subsequent calls replay free with a SIWX signature')
  .handler(async ({ wallet, charge }) => {
    await charge('0.002');
    return {
      wallet: wallet ?? null,
      reading: readings[Math.floor(Math.random() * readings.length)],
      timestamp: new Date().toISOString(),
    };
  });

// ---------------------------------------------------------------------------
// POST + GET /api/fortune/favorites — SIWX identity, no payment. POST also
// exercises `.validate()` running BEFORE the SIWX challenge is shown.
//   agentcash fetch http://localhost:3000/api/fortune/favorites \
//     --method POST -b '{"fortune":"A good day awaits"}'
//   agentcash fetch http://localhost:3000/api/fortune/favorites
//
// To hit the validate-rejection path (fortune > 100 chars → 400 before SIWX):
//   agentcash fetch http://localhost:3000/api/fortune/favorites --method POST \
//     -b '{"fortune":"<more than 100 chars of text...>"}'
// ---------------------------------------------------------------------------

const SaveFavoriteSchema = z.object({
  fortune: z.string().min(1).describe('The fortune text to save'),
});

const walletFavorites = new Map<string, string[]>();
const MAX_FAVORITES = 3;

router
  .route('fortune/favorites')
  .siwx()
  .body(SaveFavoriteSchema)
  .validate(async (body) => {
    if (body.fortune.length > 100) {
      throw new HttpError('Fortune too long (max 100 chars)', 400);
    }
  })
  .description('Save a favorite fortune (SIWX protected, max 3 per wallet)')
  .handler(async ({ body, wallet }) => {
    const favorites = walletFavorites.get(wallet!) ?? [];

    if (favorites.length >= MAX_FAVORITES) {
      throw new HttpError(`Max ${MAX_FAVORITES} favorites per wallet`, 409);
    }

    if (favorites.includes(body.fortune)) {
      throw new HttpError('Fortune already saved', 409);
    }

    favorites.push(body.fortune);
    walletFavorites.set(wallet!, favorites);

    return {
      success: true,
      fortune: body.fortune,
      totalFavorites: favorites.length,
      wallet,
    };
  });

router
  .route('fortune/favorites')
  .siwx()
  .method('GET')
  .description('Get your saved favorite fortunes')
  .handler(async ({ wallet }) => {
    const favorites = walletFavorites.get(wallet!) ?? [];
    return {
      wallet,
      favorites,
      count: favorites.length,
    };
  });

// ---------------------------------------------------------------------------
// POST /api/fortune/dynamic — function-based compute pricing: the price is
// computed from the request body, and the compute function also pre-payment
// validates. The challenge price varies by `depth`.
//   agentcash fetch http://localhost:3000/api/fortune/dynamic \
//     --method POST -b '{"category":"love","depth":"detailed"}'
//
// To hit the pricing-fn rejection (returns 400 before any 402):
//   agentcash fetch http://localhost:3000/api/fortune/dynamic \
//     --method POST -b '{"category":"wealth","depth":"comprehensive"}'
// ---------------------------------------------------------------------------

const DynamicSchema = z.object({
  category: z.enum(['love', 'career', 'health', 'wealth']),
  depth: z.enum(['brief', 'detailed', 'comprehensive']).default('brief'),
});

const dynamicPricing: Record<string, number> = {
  brief: 0.01,
  detailed: 0.03,
  comprehensive: 0.05,
};

const dynamicFortunes: Record<string, Record<string, string>> = {
  love: {
    brief: 'Love finds you soon.',
    detailed: 'A meaningful connection is forming. Stay open to unexpected encounters this week.',
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

const pricingFn = async (body: Record<string, unknown>) => {
  const depth = (body.depth as string) ?? 'brief';
  const category = body.category as string;

  if (blockedCombos.has(`${category}:${depth}`)) {
    throw new HttpError('Wealth + comprehensive is temporarily unavailable', 400);
  }

  let cost: number = dynamicPricing[depth] ?? dynamicPricing.brief;
  if (cost > 1.0) {
    cost = 0.99;
  }
  return cost.toFixed(2);
};

router
  .route('fortune/dynamic')
  .description('Body-derived pricing fortune with pre-payment validation')
  .paid(pricingFn, { maxPrice: '1.00' })
  .body(DynamicSchema)
  .handler(async ({ body, wallet }) => ({
    fortune: dynamicFortunes[body.category]?.[body.depth] ?? 'The future is unclear.',
    category: body.category,
    depth: body.depth,
    price: dynamicPricing[body.depth],
    wallet,
    timestamp: new Date().toISOString(),
  }));

// ---------------------------------------------------------------------------
// POST /api/fortune/llm — MPP session request-mode: one tick committed per
// request at credential verify. Handler returns a value (not a generator), so
// there is no `charge()` callback. For x402 single-settle billing, see
// `/api/fortune/premium`, which uses `.upTo()` and calls `charge(amount)`
// from the handler.
//   agentcash fetch http://localhost:3000/api/fortune/llm \
//     --method POST -p mpp -b '{"prompt":"Will I find love?"}'
// ---------------------------------------------------------------------------

const LlmSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const llmFortunes = [
  'The future is brighter than your screen.',
  'A stranger will give you advice. Take it.',
  'Patience now will repay you tenfold next month.',
  'Today is the day. Probably.',
];

router
  .route('fortune/llm')
  .description('Request-mode metered fortune — bills tickCost per request via MPP session')
  .metered({
    tickCost: '0.001',
    maxPrice: '0.01',
    unitType: 'request',
    protocols: ['mpp'],
  })
  .body(LlmSchema)
  .handler(async ({ wallet }) => ({
    fortune: llmFortunes[Math.floor(Math.random() * llmFortunes.length)]!,
    wallet,
    timestamp: new Date().toISOString(),
  }));

// ---------------------------------------------------------------------------
// POST /api/fortune/stream — MPP session SSE streaming: the handler is an
// async generator and each `charge()` call reserves one voucher tick from the
// session channel. Restricted to MPP because x402 has no streaming primitive.
//   agentcash fetch http://localhost:3000/api/fortune/stream \
//     --method POST -b '{"prompt":"What awaits me?"}' --stream
// ---------------------------------------------------------------------------

const StreamSchema = z.object({
  prompt: z.string().min(1).max(280),
});

const FORTUNE_TOKENS = ['A', 'fortunate', 'turn', 'awaits', 'you', 'on', 'the', 'next', 'block.'];

router
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
