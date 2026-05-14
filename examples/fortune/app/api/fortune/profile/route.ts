import { router } from '../../../../lib/router';

// Tests SIWX (Sign-In-with-X) — verified wallet identity, no payment.
// Supports EVM (Base) and Solana wallets via `x402.accepts`.
// agentcash invokes this with:
//   agentcash fetch http://localhost:3000/api/fortune/profile

export const GET = router
  .route('fortune/profile')
  .siwx()
  .method('GET')
  .description('Get verified wallet identity (SIWX, no payment)')
  .handler(async ({ wallet }) => ({
    wallet: wallet!,
    message: 'Identity verified via Sign-In with X',
  }));
