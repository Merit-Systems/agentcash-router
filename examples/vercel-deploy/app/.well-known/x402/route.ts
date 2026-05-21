import '@/lib/routes';
import { router } from '@/lib/router';

// x402 protocol discovery endpoint — distinct from AgentCash Discovery
// (/openapi.json). Used by x402-native crawlers that don't speak OpenAPI.
export const GET = router.wellKnown();
