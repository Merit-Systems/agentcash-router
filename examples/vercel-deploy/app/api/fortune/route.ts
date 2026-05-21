import { router } from '@/lib/router';

// x402 exact (Base) or MPP one-shot (Tempo) — same route, client picks the rail.
//   agentcash fetch <origin>/api/fortune --method POST -p x402
//   agentcash fetch <origin>/api/fortune --method POST -p mpp

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

export const POST = router
  .route('fortune')
  .paid('0.001')
  .description('Random fortune — fixed price; x402 exact or MPP one-shot')
  .handler(async () => ({
    fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
    timestamp: new Date().toISOString(),
  }));
