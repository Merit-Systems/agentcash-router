// Single optional catch-all serving every registered route under /api/*.
// The side-effect import MUST come first — it registers all routes with the
// router before any request is dispatched.
import '@/lib/routes';
import { router } from '@/lib/router';
import { nextHandlers } from '@agentcash/router/next';

export const { GET, POST, PUT, PATCH, DELETE } = nextHandlers(router);
