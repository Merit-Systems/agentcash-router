import { mppx } from '@/app/lib/mppx';

const fortunes = [
  'A beautiful, smart, and loving person will be coming into your life.',
  'A dubious friend may be an enemy in camouflage.',
  'A feather in the hand is better than a bird in the air.',
  'A fresh start will put you on your way.',
  'A friend asks only for your time not your money.',
  'A golden egg of opportunity falls into your lap this month.',
  'A good friendship is often more important than a passionate romance.',
  'A good time to finish up old tasks.',
  'A lifetime of happiness lies ahead of you.',
];

export const POST = mppx.charge({ amount: '0.001' })(() =>
  Response.json({
    fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
    timestamp: new Date().toISOString(),
  }),
);
