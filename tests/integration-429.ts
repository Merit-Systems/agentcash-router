/**
 * Integration test: facilitator returning 429 on /supported.
 *
 * Spins up a fake facilitator HTTP server that always 429s, creates a REAL
 * router with REAL @x402/core, and verifies the downstream response is a
 * clear 500 — not a bare 402 with no payment info.
 *
 * Run: npx tsx tests/integration-429.ts
 */

import http from 'node:http';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// 1. Fake facilitator that always 429s on /supported
// ---------------------------------------------------------------------------

const facilitator = http.createServer((req, res) => {
  if (req.url === '/supported') {
    res.writeHead(429, { 'Content-Type': 'text/plain' });
    res.end('Too Many Requests');
    return;
  }
  // Verify/settle shouldn't be called, but handle gracefully
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Unexpected call');
});

async function main() {
  // Start on random port
  await new Promise<void>((resolve) => facilitator.listen(0, resolve));
  const port = (facilitator.address() as { port: number }).port;
  const facilitatorUrl = `http://127.0.0.1:${port}`;

  console.log(`Fake facilitator listening on ${facilitatorUrl} (always 429 on /supported)\n`);

  // ---------------------------------------------------------------------------
  // 2. Create real router pointing at the fake facilitator
  // ---------------------------------------------------------------------------

  const { createRouter } = await import('../src/index.js');

  const router = createRouter({
    payeeAddress: '0x0000000000000000000000000000000000000001',
    baseUrl: 'http://localhost:3000',
    x402: {
      facilitators: {
        evm: facilitatorUrl,
      },
    },
    prices: { 'test/route': '0.01' },
  });

  const handler = router
    .route('test/route')
    .body((await import('zod')).z.object({ query: (await import('zod')).z.string() }))
    .handler(async () => ({ result: 'should never reach here' }));

  // Give init time to complete (retryInit has backoff delays)
  console.log('Waiting for router init (retryInit backoff: 1s + 2s + 4s)...');
  // The init runs in the background via deps.initPromise. The first request
  // will await it. We just send the request and it'll wait internally.

  // ---------------------------------------------------------------------------
  // 3. Send a probe request (no payment header) — triggers 402 challenge path
  // ---------------------------------------------------------------------------

  const request = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
  console.log('Sending probe request...\n');

  const response = await handler(request);
  const status = response.status;
  const body = await response.json().catch(() => null);
  const paymentHeader = response.headers.get('PAYMENT-REQUIRED');

  // ---------------------------------------------------------------------------
  // 4. Verify
  // ---------------------------------------------------------------------------

  console.log(`Status:             ${status}`);
  console.log(`PAYMENT-REQUIRED:   ${paymentHeader ? 'present' : 'missing'}`);
  console.log(`Body:               ${JSON.stringify(body)}\n`);

  let passed = true;

  if (status === 402 && !paymentHeader) {
    console.log('FAIL: Bare 402 with no PAYMENT-REQUIRED header.');
    console.log('      Client gets an unpayable 402 — this is the bug.');
    passed = false;
  } else if (status === 402 && paymentHeader) {
    console.log('PASS: Got 402 with PAYMENT-REQUIRED header — proper payable challenge.');
    console.log('      getSupported() was bypassed (hardcoded for EVM exact).');
    console.log('      Facilitator 429 on /supported no longer breaks init.');
  } else if (status === 500) {
    console.log('PASS: Got 500 with clear error message.');
    console.log('      Operators will see the facilitator failure in logs.');
  } else {
    console.log(`UNEXPECTED: Status ${status} — investigate.`);
    passed = false;
  }

  facilitator.close();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  facilitator.close();
  process.exit(1);
});
