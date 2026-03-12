import { router } from '../../../../lib/router';

/**
 * SIWX-only endpoint: returns the verified wallet identity.
 * No payment required. Supports both EVM (Base) and Solana wallets.
 *
 * Test (returns 402 SIWX challenge):
 *   curl -i http://localhost:3000/api/fortune/profile
 *
 * With SIGN-IN-WITH-X header returns { wallet }.
 */
export const GET = router
  .route('fortune/profile')
  .siwx()
  .method('GET')
  .description('Get verified wallet identity (SIWX, no payment)')
  .handler(async ({ wallet }) => ({
    wallet: wallet!,
    message: 'Identity verified via Sign-In with X',
  }));
