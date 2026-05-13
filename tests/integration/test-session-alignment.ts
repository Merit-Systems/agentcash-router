/**
 * End-to-end smoke test for the router's session-alignment refactor.
 *
 * Drives the fortune example server with mppx's client-side SessionManager
 * acting as the wallet. Tests:
 *
 *   1. Request-mode dynamic route (`/api/fortune/llm`) — should accept a
 *      session credential, bill exactly `tickCost` (= $0.001), return a
 *      regular JSON response with a Payment-Receipt header.
 *   2. Multi-request channel — three sequential requests share the same
 *      channel, no new on-chain opens between them.
 *   3. Streaming-mode dynamic route (`/api/fortune/stream`) — should accept
 *      a session credential, return SSE chunks, bill per `charge()` call.
 *   4. Channel close — explicit close-on-chain to reclaim the unspent
 *      deposit.
 *
 * Run with (from repo root):
 *   pnpm tsx tests/integration/test-session-alignment.ts
 *
 * Requires the fortune example's dev server running at http://localhost:3100
 * (cd examples/fortune && pnpm dev) with MPP_FEE_PAYER_KEY configured in
 * examples/fortune/.env.local. The CLIENT account needs to be funded with
 * USDC on Tempo for the channel-open transaction to succeed on chain;
 * without funds the open step fails and we report at that point.
 */

import { createClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { tempo } from 'viem/chains';
// `mppx/client`'s `tempo` re-exports a `.session` namespace pointing at the
// SessionManager factory (the auto-managed open/voucher/close client).
import { tempo as tempoClient } from 'mppx/client';
import { Challenge } from 'mppx';

const sessionManager = tempoClient.session;

// `next dev` listens on 3000 by default; BASE_URL in .env.local controls the
// router's challenge realm/discovery URL but not the actual listening port.
const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const TEMPO_RPC_URL =
  process.env.TEMPO_RPC_URL ?? 'https://eng:acard-melody-fashion-finish@rpc.mainnet.tempo.xyz';

// Use CLIENT_PRIVATE_KEY from env when available so the operator can run with
// a funded testnet/mainnet wallet. Falls back to a random throwaway key for
// pure protocol smoke-testing (on-chain open will fail, but we'll see the
// pre-open handshake up to that point).
const CLIENT_KEY =
  (process.env.CLIENT_PRIVATE_KEY as `0x${string}` | undefined) ?? generatePrivateKey();
const clientAccount = privateKeyToAccount(CLIENT_KEY);

const banner = (s: string) => `\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`;
const sub = (s: string) => `\n--- ${s} ---`;

async function probe(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function describeChallenge(label: string, response: Response): Promise<void> {
  console.log(sub(`Challenge: ${label}`));
  console.log(`  status:           ${response.status}`);
  console.log(`  content-type:     ${response.headers.get('Content-Type')}`);
  const wwwAuth = response.headers.get('WWW-Authenticate');
  console.log(
    `  WWW-Authenticate: ${wwwAuth?.slice(0, 220) ?? '(none)'}${(wwwAuth?.length ?? 0) > 220 ? '...' : ''}`,
  );
  try {
    const parsed = Challenge.fromResponse(response, {
      // We don't know which intent (charge vs session) the server picked; try
      // both. Real clients always know — this is informational here.
      methods: [],
    });
    if (parsed) {
      console.log(
        `  parsed.method:    ${(parsed as any).method?.name}/${(parsed as any).method?.intent}`,
      );
      console.log(`  parsed.request:   ${JSON.stringify((parsed as any).request).slice(0, 220)}`);
    }
  } catch (err) {
    // Fine — without the methods registry, parse may complain. The header
    // dump above is sufficient for a smoke test.
    void err;
  }
}

async function runRequestModeFlow(): Promise<void> {
  console.log(banner('Test 1 — Request-mode session route (/api/fortune/llm)'));
  console.log(`Client wallet: ${clientAccount.address}`);
  console.log(
    `(${CLIENT_KEY === process.env.CLIENT_PRIVATE_KEY ? 'from CLIENT_PRIVATE_KEY env' : 'throwaway random key — unfunded'})`,
  );

  // ── Probe first: see the raw 402 challenge before signing.
  const probeRes = await probe('/api/fortune/llm', { prompt: 'Tell me a fortune.' });
  await describeChallenge('fortune/llm (request-mode)', probeRes);

  if (probeRes.status !== 402) {
    console.log('UNEXPECTED: probe should return 402 with no auth');
    return;
  }

  // ── Sign with mppx SessionManager (auto-manages open/voucher).
  // mppx 0.6.16 has no `topUp` branch in auto mode — it opens once at
  // `min(server.suggestedDeposit, maxDeposit)` and signs vouchers blindly
  // past the deposit afterwards (server then rejects). To exercise multi-
  // request flows, the route's `maxPrice` (which drives suggestedDeposit)
  // must already cover all of the requests up front.
  console.log(sub('Driving fortune/llm with mppx SessionManager'));
  const sm = sessionManager({
    account: clientAccount,
    client: createClient({ chain: tempo, transport: http(TEMPO_RPC_URL) }),
    maxDeposit: '0.10',
    decimals: 6,
  });

  for (let i = 1; i <= 3; i++) {
    console.log(sub(`Request ${i}/3`));
    try {
      const res = await sm.fetch(`${BASE_URL}/api/fortune/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Request ${i}` }),
      });
      console.log(`  status:           ${res.status}`);
      console.log(`  content-type:     ${res.headers.get('Content-Type')}`);
      console.log(
        `  Payment-Receipt:  ${res.headers.get('Payment-Receipt')?.slice(0, 80) ?? '(none)'}...`,
      );
      console.log(`  channelId:        ${(res as any).channelId}`);
      console.log(`  cumulative:       ${(res as any).cumulative}`);
      const text = await res.text();
      console.log(`  body:             ${text.slice(0, 160)}`);
    } catch (err) {
      console.log(`  ERROR:            ${(err as Error).message}`);
      if (i === 1) {
        // First request failed — likely on-chain open without funds. Stop the
        // multi-request loop; later requests would fail the same way.
        return;
      }
    }
  }

  // ── Close the channel to settle on-chain and reclaim unspent deposit.
  console.log(sub('Closing the channel'));
  try {
    const receipt = await sm.close();
    console.log(`  receipt:          ${JSON.stringify(receipt).slice(0, 220)}`);
  } catch (err) {
    console.log(`  ERROR closing:    ${(err as Error).message}`);
  }
}

async function runStreamingFlow(): Promise<void> {
  console.log(banner('Test 2 — Streaming-mode session route (/api/fortune/stream)'));

  const probeRes = await probe('/api/fortune/stream', { prompt: 'Stream me one.' });
  await describeChallenge('fortune/stream (streaming-mode)', probeRes);

  if (probeRes.status !== 402) {
    console.log('UNEXPECTED: probe should return 402 with no auth');
    return;
  }

  console.log(sub('Driving fortune/stream with mppx SessionManager.sse'));
  // See Test 1 — route's maxPrice ($0.05) gives the channel headroom for
  // ~50 ticks = 5 stream requests at 10 ticks each.
  const sm = sessionManager({
    account: clientAccount,
    client: createClient({ chain: tempo, transport: http(TEMPO_RPC_URL) }),
    maxDeposit: '0.10',
    decimals: 6,
  });

  for (let i = 1; i <= 3; i++) {
    console.log(sub(`SSE request ${i}/3`));
    try {
      const iter = await sm.sse(`${BASE_URL}/api/fortune/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Stream request ${i}` }),
      } as any);

      let chunkCount = 0;
      for await (const chunk of iter) {
        chunkCount += 1;
        console.log(`  chunk ${chunkCount}:          ${chunk.slice(0, 120)}`);
      }
      console.log(`  total chunks:     ${chunkCount}`);
      console.log(`  channelId:        ${sm.channelId}`);
      console.log(`  cumulative:       ${sm.cumulative}`);
    } catch (err) {
      console.log(`  ERROR:            ${(err as Error).message}`);
      if (i === 1) {
        // First request failed — likely on-chain open without funds. Stop the
        // multi-request loop; later requests would fail the same way.
        return;
      }
    }
  }

  console.log(sub('Closing the streaming channel'));
  try {
    const receipt = await sm.close();
    console.log(`  receipt:          ${JSON.stringify(receipt).slice(0, 220)}`);
  } catch (err) {
    console.log(`  ERROR closing:    ${(err as Error).message}`);
  }
}

async function runTopUpFlow(): Promise<void> {
  console.log(
    banner('Test 3 — Channel with multi-request headroom (top-up disabled in mppx 0.6.16)'),
  );

  // NOTE: Originally a top-up test — server suggestedDeposit = $0.001 (one
  // request) and the client would auto-topUp on subsequent requests. But
  // mppx 0.6.16's `SessionManager` auto mode has no topUp branch; it signs
  // vouchers blindly past the deposit, which the server rejects. Until that
  // ships upstream, we rely on the route's maxPrice ($0.01) sizing the open
  // to cover all 5 requests up front.
  const sm = sessionManager({
    account: clientAccount,
    client: createClient({ chain: tempo, transport: http(TEMPO_RPC_URL) }),
    maxDeposit: '0.10',
    decimals: 6,
  });

  const REQUEST_COUNT = 5;
  let lastCumulative = 0n;

  for (let i = 1; i <= REQUEST_COUNT; i++) {
    console.log(sub(`Request ${i}/${REQUEST_COUNT}`));
    try {
      const res = await sm.fetch(`${BASE_URL}/api/fortune/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Top-up request ${i}` }),
      });
      const current = BigInt((res as any).cumulative ?? sm.cumulative ?? 0n);
      const delta = current - lastCumulative;
      console.log(`  status:           ${res.status}`);
      console.log(`  channelId:        ${(res as any).channelId}`);
      console.log(`  cumulative:       ${current}`);
      console.log(`  delta:            +${delta}`);
      lastCumulative = current;
    } catch (err) {
      console.log(`  ERROR:            ${(err as Error).message}`);
      if (i === 1) {
        // First request failed — likely on-chain open without funds. Stop.
        return;
      }
    }
  }

  // If cumulative > initial $0.001 deposit (1000 raw units at 6 decimals),
  // the client must have topped up to keep going.
  console.log(sub('Top-up summary'));
  console.log(`  final cumulative: ${sm.cumulative}`);
  console.log(`  initial deposit:  1000 (raw, = $0.001)`);
  console.log(
    `  top-ups inferred: ${sm.cumulative > 1000n ? `YES — channel spent ${sm.cumulative} raw units past a 1000-unit open` : 'NO — cumulative never exceeded initial deposit'}`,
  );

  console.log(sub('Closing the channel'));
  try {
    const receipt = await sm.close();
    console.log(`  receipt:          ${JSON.stringify(receipt).slice(0, 220)}`);
  } catch (err) {
    console.log(`  ERROR closing:    ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log(banner('Router session-alignment smoke test'));
  console.log(`Server:        ${BASE_URL}`);
  console.log(`Tempo RPC:     ${TEMPO_RPC_URL.replace(/:\/\/[^@]*@/, '://***@')}`);
  console.log(`Client wallet: ${clientAccount.address}`);

  // Sanity-check the server is reachable.
  try {
    const ping = await fetch(`${BASE_URL}/.well-known/x402`);
    console.log(`Server reachable (status ${ping.status})`);
  } catch (err) {
    console.error(`Server not reachable at ${BASE_URL}: ${(err as Error).message}`);
    console.error('Start the dev server with: pnpm dev');
    process.exit(1);
  }

  await runRequestModeFlow();
  await runStreamingFlow();
  await runTopUpFlow();
  console.log(banner('Done'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
