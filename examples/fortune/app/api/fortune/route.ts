import { router } from '../../../lib/router';

const fortunes = [
  'A beautiful, smart, and loving person will be coming into your life.',
  'A dubious friend may be an enemy in camouflage.',
  'A feather in the hand is better than a bird in the air.',
  'A fresh start will put you on your way.',
  'A friend asks only for your time not your money.',
  'A gambler not only will lose what he has, but also will lose what he doesn\'t have.',
  'A golden egg of opportunity falls into your lap this month.',
  'A good friendship is often more important than a passionate romance.',
  'A good time to finish up old tasks.',
  'A lifetime of happiness lies ahead of you.',
];

export const POST = router
  .route('fortune')
  .handler(async () => {
    const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];

    return {
      fortune: randomFortune,
      timestamp: new Date().toISOString(),
    };
  });
