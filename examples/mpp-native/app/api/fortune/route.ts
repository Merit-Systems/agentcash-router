import { Mppx, tempo } from 'mppx/nextjs';

const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c0000000000000000000000000000000000000', // PathUSD on Tempo mainnet
      recipient: (process.env.MPP_RECIPIENT_ADDRESS ?? '0x0') as `0x${string}`,
      ...(process.env.TEMPO_RPC_URL
        ? {
            getClient: async () => {
              const { createClient, http } = await import('viem');
              const { tempo: tempoChain } = await import('viem/chains');
              return createClient({ chain: tempoChain, transport: http(process.env.TEMPO_RPC_URL) });
            },
          }
        : {}),
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY!,
});

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
