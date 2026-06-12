import '@/lib/routes';
import { router } from '@/lib/router';

// x402-native discovery. Lives outside the /api catch-all, so it gets its own
// route file (option 1 in the `nextHandlers` docs — the alternative is a
// middleware rewrite into `/api/.well-known/x402`).
export const GET = router.wellKnown();
