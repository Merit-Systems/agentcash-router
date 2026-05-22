import { router } from '@/lib/router';

// .upTo().siwx() — pay once with x402, then replay for free using a SIWX wallet
// signature. The handler calls charge(amount); on the first paid request it
// settles a real total, on a SIWX-entitled replay it's a no-op.
//
// First request — pays via x402 and grants entitlement to the wallet:
//   agentcash fetch <origin>/api/fortune/membership --method POST -p x402
//
// Subsequent requests — CLI presents a SIWX signature, no payment:
//   agentcash fetch <origin>/api/fortune/membership --method POST
//
// IMPORTANT: in serverless, this requires a real `kvStore` (Vercel KV / Upstash).
// Without one, entitlements live in a per-instance Map and the wallet pays again
// every time it hits a fresh Lambda.

const readings = [
  'Mercury favors you — act on your boldest idea this week.',
  'Saturn rewards patience: the door you knocked on once will open quietly.',
  'Mars is restless. Channel that into something physical before it lights you up.',
  'Venus brings someone unexpected into orbit. Listen more than you speak.',
];

export const POST = router
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
