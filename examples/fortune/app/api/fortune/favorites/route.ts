import { z } from 'zod';
import { router } from '../../../../lib/router';

const SaveFavoriteSchema = z.object({
  fortune: z.string().min(1).describe('The fortune text to save'),
});

// Simulate per-wallet favorites storage (resets on server restart)
const walletFavorites = new Map<string, string[]>();
const MAX_FAVORITES = 3;

/**
 * SIWX-protected favorites endpoint with pre-auth validation.
 *
 * Demonstrates `.validate()` with SIWX auth - validation runs before
 * the SIWX challenge is shown, rejecting invalid requests early.
 *
 * Test validate pass (returns 402 SIWX challenge):
 *   curl -X POST http://localhost:3001/api/fortune/favorites \
 *     -H "Content-Type: application/json" \
 *     -d '{"fortune": "A good day awaits"}'
 *
 * Test validate fail (fortune too long - returns 400 before SIWX):
 *   curl -X POST http://localhost:3001/api/fortune/favorites \
 *     -H "Content-Type: application/json" \
 *     -d '{"fortune": "This fortune is way too long and exceeds the maximum allowed length for storage in our system which is limited to keep things concise and meaningful"}'
 */
export const POST = router
  .route('fortune/favorites')
  .siwx()
  .body(SaveFavoriteSchema)
  .validate(async (body) => {
    // Business validation: fortune must be reasonable length
    if (body.fortune.length > 100) {
      throw Object.assign(
        new Error('Fortune too long (max 100 chars)'),
        { status: 400 },
      );
    }
  })
  .description('Save a favorite fortune (SIWX protected, max 3 per wallet)')
  .handler(async ({ body, wallet }) => {
    const favorites = walletFavorites.get(wallet!) ?? [];

    if (favorites.length >= MAX_FAVORITES) {
      throw Object.assign(
        new Error(`Max ${MAX_FAVORITES} favorites per wallet`),
        { status: 409 },
      );
    }

    if (favorites.includes(body.fortune)) {
      throw Object.assign(
        new Error('Fortune already saved'),
        { status: 409 },
      );
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

/**
 * Get wallet's saved favorites (SIWX protected, no validation needed).
 */
export const GET = router
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
