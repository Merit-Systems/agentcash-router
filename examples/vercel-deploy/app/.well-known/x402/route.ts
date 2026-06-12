import '@/lib/routes';
import { router } from '@/lib/router';

// x402 protocol discovery endpoint — distinct from AgentCash Discovery
// (/openapi.json). Used by x402-native crawlers that don't speak OpenAPI.
// Lives outside the /api catch-all, so it gets its own route file (option 1
// in the `nextHandlers` docs — the alternative is a middleware rewrite).
export const GET = router.wellKnown();
