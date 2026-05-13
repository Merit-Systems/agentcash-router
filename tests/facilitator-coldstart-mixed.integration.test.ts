import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { createRouter } from '../src/index.js';

const BASE_MAINNET_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const servers: http.Server[] = [];

afterEach(() => {
  while (servers.length > 0) {
    servers.pop()?.close();
  }
});

async function startRateLimitedSolanaFacilitator() {
  let supportedCalls = 0;
  let acceptsCalls = 0;

  const server = http.createServer((req, res) => {
    if (req.url === '/supported') {
      supportedCalls += 1;
      res.writeHead(429, { 'content-type': 'text/plain' });
      res.end('Too Many Requests');
      return;
    }

    if (req.url === '/accepts' && req.method === 'POST') {
      acceptsCalls += 1;
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        const body = JSON.parse(raw || '{}') as { accepts?: unknown[] };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepts: body.accepts ?? [] }));
      });
      return;
    }

    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Unexpected call');
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  servers.push(server);

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test facilitator');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    getSupportedCalls: () => supportedCalls,
    getAcceptsCalls: () => acceptsCalls,
  };
}

describe('mixed-network facilitator cold start', () => {
  it('still returns a payable challenge when the Solana facilitator would 429 on /supported', async () => {
    const facilitator = await startRateLimitedSolanaFacilitator();

    const router = createRouter({
      baseUrl: 'http://localhost:3000',
      protocols: ['x402'],
      x402: {
        accepts: [
          { network: BASE_MAINNET_NETWORK, payTo: '0x0000000000000000000000000000000000000001' },
          { network: SOLANA_NETWORK, payTo: '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2' },
        ],
        facilitators: {
          solana: facilitator.url,
        },
      },
      discovery: {
        title: 'Test',
        version: '1.0.0',
      },
      prices: { 'test/route': '0.01' },
    });

    const handler = router.route('test/route').handler(async () => ({ ok: true }));
    const response = await handler(
      new NextRequest('http://localhost:3000/api/test/route', { method: 'POST' }),
    );

    expect(response.status).toBe(402);
    // /supported is fetched at most once per process (one logical attempt) and
    // cached. The upstream HTTPFacilitatorClient retries up to 3 times on 429,
    // so a persistently rate-limited facilitator can produce 3 raw HTTP calls
    // for one logical attempt. After that, our cache falls back to hardcoded
    // kinds for exact, so the next request makes 0 additional /supported calls.
    // What matters is we still serve a payable challenge.
    expect(facilitator.getSupportedCalls()).toBeLessThanOrEqual(3);
    expect(facilitator.getAcceptsCalls()).toBe(1);

    const header = response.headers.get('PAYMENT-REQUIRED');
    expect(header).toBeTruthy();

    const challenge = decodePaymentRequiredHeader(header!);
    expect(challenge.accepts.map((accept) => accept.network)).toEqual([
      BASE_MAINNET_NETWORK,
      SOLANA_NETWORK,
    ]);
  });
});
