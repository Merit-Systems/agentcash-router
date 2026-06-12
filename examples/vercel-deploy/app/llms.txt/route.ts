import '@/lib/routes';
import { router } from '@/lib/router';

// LLM-readable guidance generated from `createRouterFromEnv({ guidance })`.
// Agents that don't (yet) speak AgentCash Discovery natively can read this
// to learn how to call the API. The barrel import matters here too: llms.txt
// appends a "## Workflows" section derived from the registered `.nextStep()`
// chains.
export const GET = router.llmsTxt();
