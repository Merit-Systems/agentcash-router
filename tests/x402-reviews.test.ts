import { describe, expect, it } from 'vitest';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore, MemoryEntitlementStore } from '../src/kv-store/index.js';
import { makeTestAgentIdentityNonceStore } from './fakes/agent-identity-deps.js';
import { withX402Payment } from './fakes/request.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';
import type { RouteEntry } from '../src/types.js';

const BASE_MAINNET_NETWORK = 'eip155:8453';
const TX = '0x8F3D00000000000000000000000000000000000000000000000000000000C21A';

class EvmTxFakeX402Server extends FakeX402Server {
  override async settlePayment(...args: Parameters<FakeX402Server['settlePayment']>) {
    return { ...(await super.settlePayment(...args)), transaction: TX };
  }
}

function makePaidEntry(): RouteEntry {
  return {
    key: 'test',
    authMode: 'paid',
    pricing: '0.01',
    protocols: ['x402'],
    method: 'POST',
    billing: 'exact',
  };
}

function makeDeps(server: FakeX402Server, overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    agentIdentityNonceStore: makeTestAgentIdentityNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_MAINNET_NETWORK,
    x402Accepts: [{ scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE }],
    ...overrides,
  };
}

type ReviewsBlock = {
  info: {
    providers: Array<{ provider: string; read?: string; write?: string; description?: string }>;
    userQuestion?: string;
  };
  schema: { required: string[]; properties: Record<string, unknown> };
};

async function challengeExtensions(deps: RouterDeps, url = 'http://localhost:3000/api/test') {
  const handler = createRequestHandler(makePaidEntry(), async () => ({ ok: true }), deps);
  const response = await handler(new Request(url, { method: 'POST' }));
  expect(response.status).toBe(402);
  const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
  return (challenge as unknown as { extensions?: Record<string, unknown> }).extensions;
}

async function settlementExtensions(deps: RouterDeps) {
  const handler = createRequestHandler(makePaidEntry(), async () => ({ ok: true }), deps);
  const response = await handler(withX402Payment({ body: {} }));
  expect(response.status).toBe(200);
  const settlement = decodePaymentResponseHeader(response.headers.get('PAYMENT-RESPONSE')!);
  return settlement.extensions;
}

describe('reviews extension on challenges', () => {
  it('declares a read link for the requested resource when reviews is enabled', async () => {
    const extensions = await challengeExtensions(
      makeDeps(new FakeX402Server(), { reviews: true }),
      'http://localhost:3000/api/test?city=tallinn',
    );
    const block = extensions?.reviews as ReviewsBlock | undefined;
    expect(block).toBeDefined();
    expect(block!.info.providers).toEqual([
      {
        provider: 'agorean.com',
        read: 'https://agorean.com/reviews?resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Ftest',
        description: expect.any(String),
      },
    ]);
    expect(block!.schema.required).toEqual(['providers']);
    // The bazaar declaration is still there alongside it.
    expect(extensions?.bazaar).toBeDefined();
  });

  it('declares the same block on every request to the resource', async () => {
    const deps = makeDeps(new FakeX402Server(), { reviews: true });
    const first = await challengeExtensions(deps);
    const second = await challengeExtensions(deps);
    expect(second?.reviews).toEqual(first?.reviews);
  });

  it('omits the extension by default', async () => {
    const extensions = await challengeExtensions(makeDeps(new FakeX402Server()));
    expect(extensions?.reviews).toBeUndefined();
  });
});

describe('reviews extension on settlement responses', () => {
  it('adds a write link naming the settled transaction', async () => {
    const extensions = await settlementExtensions(
      makeDeps(new EvmTxFakeX402Server(), { reviews: true }),
    );
    const block = extensions?.reviews as ReviewsBlock | undefined;
    expect(block).toBeDefined();
    expect(block!.info.providers).toEqual([
      {
        provider: 'agorean.com',
        write: `https://agorean.com/r/${TX.toLowerCase()}`,
        description: expect.any(String),
      },
    ]);
    expect(block!.info.userQuestion).toEqual(expect.any(String));
    expect(block!.schema.properties).toHaveProperty('userQuestion');
  });

  it('adds nothing when the transaction is not an EVM transaction hash', async () => {
    // The default fake returns a non-hex placeholder transaction.
    const extensions = await settlementExtensions(
      makeDeps(new FakeX402Server(), { reviews: true }),
    );
    expect(extensions?.reviews).toBeUndefined();
  });

  it('adds nothing by default', async () => {
    const extensions = await settlementExtensions(makeDeps(new EvmTxFakeX402Server()));
    expect(extensions?.reviews).toBeUndefined();
  });
});
