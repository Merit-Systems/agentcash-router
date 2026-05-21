// Barrel import — registers every route module before discovery handlers run.
// Without this, `/openapi.json`, `/llms.txt`, and `/.well-known/x402` would
// miss any route Next hasn't lazy-loaded yet on first hit.
//
// All routes work out of the box with just the three x402 env vars.
// MPP routes (`llm`, `stream`) register only when MPP_OPERATOR_KEY is set;
// otherwise they serve a 503 with a hint. They don't appear in the discovery
// docs until MPP is configured — see `lib/router.ts` for the gating logic.
import '@/app/api/fortune/route';
import '@/app/api/fortune/premium/route';
import '@/app/api/fortune/profile/route';
import '@/app/api/fortune/membership/route';
import '@/app/api/fortune/favorites/route';
import '@/app/api/fortune/dynamic/route';
import '@/app/api/fortune/llm/route';
import '@/app/api/fortune/stream/route';
