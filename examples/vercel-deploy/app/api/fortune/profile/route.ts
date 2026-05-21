import { router } from '@/lib/router';

// SIWX (Sign-In-with-X) — verified wallet identity, no payment.
// Supports EVM (Base) and Solana wallets when both are configured.
//   agentcash fetch <origin>/api/fortune/profile

export const GET = router
  .route('fortune/profile')
  .siwx()
  .method('GET')
  .description('Get verified wallet identity (SIWX, no payment)')
  .handler(async ({ wallet }) => ({
    wallet: wallet!,
    message: 'Identity verified via Sign-In with X',
  }));
