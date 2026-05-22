import { z } from 'zod';
import { router } from '@/lib/router';

// SIWX (Sign-In-with-X) — wallet identity proof, no payment. POST also exercises
// `.validate()` running BEFORE the SIWX challenge is shown.
//   agentcash fetch <origin>/api/fortune/favorites --method POST -b '{"fortune":"A good day awaits"}'
//   agentcash fetch <origin>/api/fortune/favorites

const SaveFavoriteSchema = z.object({
  fortune: z.string().min(1).describe('The fortune text to save'),
});

const walletFavorites = new Map<string, string[]>();
const MAX_FAVORITES = 3;

export const POST = router
  .route('fortune/favorites')
  .siwx()
  .body(SaveFavoriteSchema)
  .validate(async (body) => {
    if (body.fortune.length > 100) {
      throw Object.assign(new Error('Fortune too long (max 100 chars)'), { status: 400 });
    }
  })
  .description('Save a favorite fortune (SIWX protected, max 3 per wallet)')
  .handler(async ({ body, wallet }) => {
    const favorites = walletFavorites.get(wallet!) ?? [];

    if (favorites.length >= MAX_FAVORITES) {
      throw Object.assign(new Error(`Max ${MAX_FAVORITES} favorites per wallet`), { status: 409 });
    }
    if (favorites.includes(body.fortune)) {
      throw Object.assign(new Error('Fortune already saved'), { status: 409 });
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
