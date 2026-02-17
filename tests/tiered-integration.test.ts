import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';
import type { RouteEntry } from '../src/types.js';

vi.mock('../src/auth/siwx.js', () => ({
  verifySIWX: async () => ({ valid: false, wallet: null, code: 'siwx_missing_header' }),
  buildSIWXExtension: () => ({}),
  SIWX_ERROR_MESSAGES: {},
}));

vi.mock('../src/protocols/mpp.js', () => ({
  buildMPPChallenge: async () => 'MOCK',
  verifyMPPCredential: async () => null,
  buildMPPReceipt: () => 'MOCK',
}));

vi.mock('../src/protocols/x402.js', async () => {
  const { FakeX402Server } = await import('./fakes/x402-server.js');
  return {
    buildX402Challenge: (
      server: InstanceType<typeof FakeX402Server>,
      routeEntry: RouteEntry,
      request: Request,
      price: string,
      payeeAddress: string,
      network: string,
      extensions?: Record<string, unknown>,
    ) => {
      const requirements = server.buildPaymentRequirementsFromOptions(
        { price, payTo: payeeAddress, scheme: 'exact', network },
        { request },
      );
      const paymentRequired = server.createPaymentRequiredResponse(
        requirements, {}, null, extensions,
      );
      return {
        encoded: Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
        requirements,
      };
    },
    verifyX402Payment: async () => null,
    settleX402Payment: async () => ({ encoded: 'MOCK', result: {} }),
  };
});

const tierSchema = z.object({
  filename: z.string().min(1).max(512),
  contentType: z.string(),
  tier: z.enum(['10mb', '100mb', '1gb']),
});

const tieredPricing = {
  field: 'tier',
  tiers: {
    '10mb': { price: '0.02', label: '10 MB' },
    '100mb': { price: '0.20', label: '100 MB' },
    '1gb': { price: '2.00', label: '1 GB' },
  },
};

function makeEntry(): RouteEntry {
  return {
    key: 'upload',
    authMode: 'paid',
    pricing: tieredPricing,
    protocols: ['x402'],
    method: 'POST',
    bodySchema: tierSchema,
  };
}

function makeDeps(): OrchestrateDeps {
  return {
    x402Server: new FakeX402Server() as any,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'eip155:8453',
  };
}

describe('tiered pricing integration (agentupload scenario)', () => {
  it('402 with tier=10mb body returns $0.02 price', async () => {
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.txt', contentType: 'text/plain', tier: '10mb' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(402);

    const pr = res.headers.get('PAYMENT-REQUIRED');
    expect(pr).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(pr!, 'base64').toString());
    expect(decoded.requirements[0].maxAmountRequired).toBe('0.02');
  });

  it('402 with tier=100mb body returns $0.20 price', async () => {
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.txt', contentType: 'text/plain', tier: '100mb' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(402);

    const pr = res.headers.get('PAYMENT-REQUIRED');
    const decoded = JSON.parse(Buffer.from(pr!, 'base64').toString());
    expect(decoded.requirements[0].maxAmountRequired).toBe('0.20');
  });

  it('402 with tier=1gb body returns $2.00 price', async () => {
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'big.zip', contentType: 'application/zip', tier: '1gb' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(402);

    const pr = res.headers.get('PAYMENT-REQUIRED');
    const decoded = JSON.parse(Buffer.from(pr!, 'base64').toString());
    expect(decoded.requirements[0].maxAmountRequired).toBe('2.00');
  });

  it('402 without body falls back to max price ($2.00)', async () => {
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
    });
    const res = await handler(req);
    expect(res.status).toBe(402);

    const pr = res.headers.get('PAYMENT-REQUIRED');
    const decoded = JSON.parse(Buffer.from(pr!, 'base64').toString());
    expect(decoded.requirements[0].maxAmountRequired).toBe('2.00');
  });
});
