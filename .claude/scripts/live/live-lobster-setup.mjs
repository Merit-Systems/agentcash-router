import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseConfig, runSetupFlow } from '@crossmint/lobster-cli';

const cwd = process.cwd();
process.env.LOBSTER_CASH_WALLETS_DIR ||= path.join(cwd, '.lobster');

const agentId = process.env.LOBSTER_AGENT_ID || 'router-live';
const config = parseConfig({
  serverBaseUrl: process.env.LOBSTER_SERVER_BASE_URL || 'https://www.lobster.cash',
  requestTimeoutMs: process.env.LOBSTER_REQUEST_TIMEOUT_MS
    ? Number(process.env.LOBSTER_REQUEST_TIMEOUT_MS)
    : 15000,
});

async function main() {
  const result = await runSetupFlow(agentId, config);
  console.log(
    JSON.stringify(
      {
        ...result,
        walletStoreDir: process.env.LOBSTER_CASH_WALLETS_DIR,
        nextStep:
          result.status === 'pending_configuration'
            ? 'Open consentUrl, approve, then rerun test:live:lobster:setup'
            : result.status === 'configured' || result.status === 'already_configured'
              ? 'Run test:live:lobster:exact'
              : undefined,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        step: 'error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
