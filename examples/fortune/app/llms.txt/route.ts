import '@/lib/routes';
import { router } from '@/lib/router';

// LLM-readable guidance (`discovery.guidance`). The barrel import matters
// here too: llms.txt appends a "## Workflows" section derived from the
// registered `.nextStep()` chains.
export const GET = router.llmsTxt();
