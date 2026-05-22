import '@/lib/routes';
import { router } from '@/lib/router';

// AgentCash Discovery — OpenAPI 3.x with `x-agentcash-*` extensions describing
// pricing, payment rails, and SIWX requirements. Crawlable by AgentCash, x402scan,
// MPPscan, Agentic.market, and anyone else who follows the spec.
export const GET = router.openapi();
