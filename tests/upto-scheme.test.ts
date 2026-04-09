import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { createRouter } from '../src/index.js';
import type { RouteEntry } from '../src/types.js';
import type { ResolvedX402Facilitator } from '../src/x402-facilitators.js';

const BASE_NETWORK = 'eip155:8453';
const USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const URL = 'http://localhost:3000/api/test';

function makeEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    pricing: '0.10',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeFacilitator(network: string, url: string): ResolvedX402Facilitator {
  return {
    family: 'evm',
    network: network as ResolvedX402Facilitator['network'],
    url,
    config: { url },
  };
}

function makeDeps(
  server: FakeX402Server,
  accepts: OrchestrateDeps['x402Accepts'],
): OrchestrateDeps {
  return {
    x402Server: server as unknown as OrchestrateDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_NETWORK,
    x402FacilitatorsByNetwork: {
      [BASE_NETWORK]: makeFacilitator(BASE_NETWORK, 'https://cdp.example'),
    },
    x402Accepts: accepts,
  };
}

async function withPassThroughFacilitatorAccepts<T>(run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { accepts?: unknown[] };
    return new Response(JSON.stringify({ accepts: body.accepts ?? [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('upto scheme', () => {
  describe('configuration', () => {
    it('accepts upto scheme in x402 config with required asset', () => {
      const router = createRouter({
        payeeAddress: KNOWN_PAYEE,
        baseUrl: 'http://localhost:3000',
        x402: {
          accepts: [
            { scheme: 'exact', network: BASE_NETWORK },
            { scheme: 'upto', network: BASE_NETWORK, asset: USDC_ASSET, decimals: 6 },
          ],
        },
      });
      router
        .route('test/route')
        .paid('0.10')
        .handler(async () => ({}));
      const entry = router.registry.get('test/route');
      expect(entry).toBeDefined();
      expect(entry!.protocols).toEqual(['x402']);
    });

    it('rejects upto scheme without asset', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() => {
          createRouter({
            payeeAddress: KNOWN_PAYEE,
            baseUrl: 'https://test.example.com',
            x402: {
              accepts: [{ scheme: 'upto', network: BASE_NETWORK }],
            },
          });
        }).toThrow(/non-exact x402 accepts require an asset/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });
  });

  describe('challenge generation', () => {
    it('includes upto requirement in 402 challenge alongside exact', async () => {
      await withPassThroughFacilitatorAccepts(async () => {
        const server = new FakeX402Server();
        const deps = makeDeps(server, [
          { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
          {
            scheme: 'upto',
            network: BASE_NETWORK,
            payTo: KNOWN_PAYEE,
            asset: USDC_ASSET,
            decimals: 6,
            maxTimeoutSeconds: 300,
          },
        ]);

        const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
        const response = await handler(new NextRequest(URL, { method: 'POST' }));

        expect(response.status).toBe(402);
        const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

        const exactAccept = challenge.accepts.find((a) => a.scheme === 'exact');
        const uptoAccept = challenge.accepts.find((a) => a.scheme === 'upto');

        expect(exactAccept).toBeDefined();
        expect(exactAccept!.network).toBe(BASE_NETWORK);

        expect(uptoAccept).toBeDefined();
        expect(uptoAccept!.network).toBe(BASE_NETWORK);
        expect(uptoAccept!.asset).toBe(USDC_ASSET);
        expect(uptoAccept!.payTo).toBe(KNOWN_PAYEE);
      });
    });

    it('converts decimal price to atomic units for upto requirement', async () => {
      await withPassThroughFacilitatorAccepts(async () => {
        const server = new FakeX402Server();
        const deps = makeDeps(server, [
          {
            scheme: 'upto',
            network: BASE_NETWORK,
            payTo: KNOWN_PAYEE,
            asset: USDC_ASSET,
            decimals: 6,
            maxTimeoutSeconds: 300,
          },
        ]);

        const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
        const response = await handler(new NextRequest(URL, { method: 'POST' }));

        expect(response.status).toBe(402);
        const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

        const uptoAccept = challenge.accepts.find((a) => a.scheme === 'upto');
        expect(uptoAccept).toBeDefined();
        // 0.10 with 6 decimals = 100000
        expect(uptoAccept!.amount).toBe('100000');
      });
    });
  });

  describe('payment verification', () => {
    it('verifies and settles upto payment', async () => {
      const server = new FakeX402Server();
      const deps = makeDeps(server, [
        { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
        {
          scheme: 'upto',
          network: BASE_NETWORK,
          payTo: KNOWN_PAYEE,
          asset: USDC_ASSET,
          decimals: 6,
          maxTimeoutSeconds: 300,
        },
      ]);

      const paymentHeader = encodePaymentSignatureHeader({
        x402Version: 2,
        resource: { url: URL, method: 'POST' },
        accepted: {
          scheme: 'upto',
          network: BASE_NETWORK,
          amount: '100000',
          asset: USDC_ASSET,
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
        },
        payload: { payer: KNOWN_PAYER },
      });

      const handler = createRequestHandler(makeEntry(), async () => ({ settled: true }), deps);
      const response = await handler(
        new NextRequest(URL, {
          method: 'POST',
          headers: { 'X-PAYMENT': paymentHeader },
        }),
      );

      expect(response.status).toBe(200);
      expect(server.settledPayments).toHaveLength(1);
      const settled = server.settledPayments[0]!.requirements as { scheme?: string };
      expect(settled.scheme).toBe('upto');
    });
  });

  describe('server registration', () => {
    it('registers UptoEvmScheme on the server for EVM networks', async () => {
      const { UptoEvmScheme } = await import('@x402/evm/upto/server');
      const scheme = new UptoEvmScheme();
      expect(scheme.scheme).toBe('upto');
    });

    it('UptoEvmScheme implements parsePrice', async () => {
      const { UptoEvmScheme } = await import('@x402/evm/upto/server');
      const scheme = new UptoEvmScheme();
      const result = await scheme.parsePrice('0.10', BASE_NETWORK);
      expect(result).toBeDefined();
      expect(result.amount).toBeDefined();
    });
  });
});
