import { router } from '../../../lib/router';

// Tests x402 exact and MPP one-shot — same fixed-price route, swap the `-p` flag.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune --method POST -p x402   # x402 exact
//   agentcash fetch http://localhost:3000/api/fortune --method POST -p mpp    # MPP one-shot
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
  .handler(async () => {
    const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return {
      fortune: randomFortune,
      timestamp: new Date().toISOString(),
    };
  });
