import '@/lib/routes';
import { router } from '@/lib/router';

// Root alias for the OpenAPI spec. The catch-all already serves it at
// /api/openapi.json; this file adds the conventional /openapi.json path.
export const GET = router.openapi();
