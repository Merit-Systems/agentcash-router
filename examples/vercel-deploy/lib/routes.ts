// Barrel import — registers every route module before discovery handlers run.
// Without this, `/openapi.json`, `/llms.txt`, and `/.well-known/x402` would
// miss any route Next hasn't lazy-loaded yet on first hit.
//
// This template ships the x402 + SIWX routes by default so a fresh deploy
// works with only EVM_PAYEE_ADDRESS + CDP_* set. For MPP streaming and
// request-mode billing, see `examples/fortune/` — copy `app/api/fortune/llm`
// and `app/api/fortune/stream` over and set the MPP_* env vars.
import '@/app/api/fortune/route';
import '@/app/api/fortune/premium/route';
import '@/app/api/fortune/profile/route';
import '@/app/api/fortune/membership/route';
import '@/app/api/fortune/favorites/route';
import '@/app/api/fortune/dynamic/route';
