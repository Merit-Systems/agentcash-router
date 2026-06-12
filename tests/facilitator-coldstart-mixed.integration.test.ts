import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { createRouter } from '../src/index.js';

const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';

const servers: http.Server[] = [];

afterEach(() => {
  while (servers.length > 0) {
    servers.pop()?.close();
  }
});

interface StubKind {
  scheme: string;
  network: string;
  x402Version: number;
  extra?: Record<string, unknown>;
}

interface StubFacilitatorOptions {
  supportedStatus?: number;
}

async function startStubFacilitator(kinds: StubKind[], options: StubFacilitatorOptions = {}) {
  const { supportedStatus = 200 } = options;
  let supportedCalls = 0;
  let acceptsCalls = 0;

  const server = http.createServer((req, res) => {
    if (req.url === '/supported') {
      supportedCalls += 1;
      if (supportedStatus !== 200) {
        res.writeHead(supportedStatus, { 'content-type': 'text/plain' });
        res.end('upstream down');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ kinds, extensions: [], signers: {} }));
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

function buildSolanaRouter(facilitatorUrl: string) {
  return createRouter({
    baseUrl: 'http://localhost:3000',
    protocols: ['x402'],
    x402: {
      accepts: [{ network: SOLANA_NETWORK, payTo: SOLANA_PAYEE }],
      facilitators: { solana: facilitatorUrl },
    },
    discovery: { title: 'Test', version: '1.0.0' },
    prices: { 'test/route': '0.01' },
  });
}

function newRequest() {
  return new Request('http://localhost:3000/api/test/route', { method: 'POST' });
}

describe('facilitator /supported memoization', () => {
  it('never calls /supported on the Solana facilitator and yields a Solana challenge', async () => {
    const facilitator = await startStubFacilitator([
      {
        scheme: 'exact',
        network: SOLANA_NETWORK,
        x402Version: 2,
        extra: { features: { xSettlementAccountSupported: true } },
      },
    ]);

    const router = buildSolanaRouter(facilitator.url);
    const handler = router.route('test/route').handler(async () => ({ ok: true }));

    const first = await handler(newRequest());
    const second = await handler(newRequest());

    expect(first.status).toBe(402);
    expect(second.status).toBe(402);
    expect(facilitator.getSupportedCalls()).toBe(0);

    const challenge = decodePaymentRequiredHeader(first.headers.get('PAYMENT-REQUIRED')!);
    expect(challenge.accepts).toHaveLength(1);
    expect(challenge.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: SOLANA_NETWORK,
      payTo: SOLANA_PAYEE,
    });
  });

  it('still builds a 402 challenge when the Solana facilitator is unreachable', async () => {
    const facilitator = await startStubFacilitator([], { supportedStatus: 500 });
    const router = buildSolanaRouter(facilitator.url);
    const handler = router.route('test/route').handler(async () => ({ ok: true }));

    const response = await handler(newRequest());
    expect(response.status).toBe(402);
    expect(facilitator.getSupportedCalls()).toBe(0);

    const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
    const solanaSchemes = challenge.accepts
      .filter((accept) => accept.network === SOLANA_NETWORK)
      .map((accept) => accept.scheme);
    expect(solanaSchemes).toEqual(['exact']);
  });

  it('omits upto on Solana even when the facilitator advertises it', async () => {
    const facilitator = await startStubFacilitator([
      { scheme: 'exact', network: SOLANA_NETWORK, x402Version: 2 },
      { scheme: 'upto', network: SOLANA_NETWORK, x402Version: 2 },
    ]);

    const router = buildSolanaRouter(facilitator.url);
    const handler = router.route('test/route').handler(async () => ({ ok: true }));

    const response = await handler(newRequest());
    expect(response.status).toBe(402);

    const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
    const solanaSchemes = challenge.accepts
      .filter((accept) => accept.network === SOLANA_NETWORK)
      .map((accept) => accept.scheme);
    expect(solanaSchemes).toEqual(['exact']);
  });
});
