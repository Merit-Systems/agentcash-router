import { describe, expect, it, vi } from 'vitest';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore } from '../src/kv-store/index.js';
import { MemoryEntitlementStore } from '../src/kv-store/index.js';
import { makeTestAgentIdentityNonceStore } from './fakes/agent-identity-deps.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { createRouter } from '../src/index.js';
import type { RouteEntry } from '../src/types.js';
import type { ResolvedX402Facilitator } from '../src/protocols/x402/facilitators.js';

const BASE_MAINNET_NETWORK = 'eip155:8453';
const USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const URL = 'http://localhost:3000/api/test';

function makeEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.10',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeUptoRouteEntry(): RouteEntry {
  return { ...makeEntry(), key: 'test/upto-route', billing: 'upto', maxPrice: '0.10' };
}

function makeFacilitator(network: string, url: string): ResolvedX402Facilitator {
  return {
    family: 'evm',
    network: network as ResolvedX402Facilitator['network'],
    url,
    config: { url },
  };
}

function makeDeps(server: FakeX402Server, accepts: RouterDeps['x402Accepts']): RouterDeps {
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    agentIdentityNonceStore: makeTestAgentIdentityNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_MAINNET_NETWORK,
    x402FacilitatorsByNetwork: {
      [BASE_MAINNET_NETWORK]: makeFacilitator(BASE_MAINNET_NETWORK, 'https://cdp.example'),
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
            { scheme: 'exact', network: BASE_MAINNET_NETWORK },
            { scheme: 'upto', network: BASE_MAINNET_NETWORK, asset: USDC_ASSET, decimals: 6 },
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
              accepts: [{ scheme: 'upto', network: BASE_MAINNET_NETWORK }],
            },
          });
        }).toThrow(/non-exact x402 accepts require an asset/);
      } finally {
        process.env.NODE_ENV = origEnv;
        spy.mockRestore();
      }
    });

    it('rejects a fixed-price .paid() route when only an upto accept is configured', () => {
      // An `upto`-only accept list cannot serve a fixed-price route: route-scoped
      // accept selection would leave the exact route with no x402 requirement.
      // The builder rejects this at registration rather than failing at runtime.
      const router = createRouter({
        payeeAddress: KNOWN_PAYEE,
        baseUrl: 'http://localhost:3000',
        x402: {
          accepts: [
            { scheme: 'upto', network: BASE_MAINNET_NETWORK, asset: USDC_ASSET, decimals: 6 },
          ],
        },
      });
      expect(() => {
        router
          .route('exact/route')
          .paid('0.10')
          .handler(async () => ({}));
      }).toThrow(/needs a non-'upto' x402 accept/);
    });
  });

  describe('challenge generation', () => {
    const bothAccepts: RouterDeps['x402Accepts'] = [
      { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
      {
        scheme: 'upto',
        network: BASE_MAINNET_NETWORK,
        payTo: KNOWN_PAYEE,
        asset: USDC_ASSET,
        decimals: 6,
        maxTimeoutSeconds: 300,
      },
    ];

    it('an exact route advertises only the exact scheme, never upto', async () => {
      await withPassThroughFacilitatorAccepts(async () => {
        const server = new FakeX402Server();
        const deps = makeDeps(server, bothAccepts);

        const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
        const response = await handler(new Request(URL, { method: 'POST' }));

        expect(response.status).toBe(402);
        const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

        const exactAccept = challenge.accepts.find((a) => a.scheme === 'exact');
        expect(exactAccept).toBeDefined();
        expect(exactAccept!.network).toBe(BASE_MAINNET_NETWORK);
        expect(challenge.accepts.find((a) => a.scheme === 'upto')).toBeUndefined();
      });
    });

    it('an upto route advertises only the upto scheme, never exact', async () => {
      await withPassThroughFacilitatorAccepts(async () => {
        const server = new FakeX402Server();
        const deps = makeDeps(server, bothAccepts);

        const handler = createRequestHandler(
          makeUptoRouteEntry(),
          async () => ({ ok: true }),
          deps,
        );
        const response = await handler(new Request(URL, { method: 'POST' }));

        expect(response.status).toBe(402);
        const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

        const uptoAccept = challenge.accepts.find((a) => a.scheme === 'upto');
        expect(uptoAccept).toBeDefined();
        expect(uptoAccept!.network).toBe(BASE_MAINNET_NETWORK);
        expect(uptoAccept!.asset).toBeTruthy();
        expect(uptoAccept!.payTo).toBe(KNOWN_PAYEE);
        expect(challenge.accepts.find((a) => a.scheme === 'exact')).toBeUndefined();
      });
    });

    it('converts decimal price to atomic units for upto requirement', async () => {
      await withPassThroughFacilitatorAccepts(async () => {
        const server = new FakeX402Server();
        const deps = makeDeps(server, [
          {
            scheme: 'upto',
            network: BASE_MAINNET_NETWORK,
            payTo: KNOWN_PAYEE,
            asset: USDC_ASSET,
            decimals: 6,
            maxTimeoutSeconds: 300,
          },
        ]);

        const handler = createRequestHandler(
          makeUptoRouteEntry(),
          async () => ({ ok: true }),
          deps,
        );
        const response = await handler(new Request(URL, { method: 'POST' }));

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
    it('verifies and settles an upto payment on an upto route', async () => {
      const server = new FakeX402Server();
      const deps = makeDeps(server, [
        {
          scheme: 'upto',
          network: BASE_MAINNET_NETWORK,
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
          network: BASE_MAINNET_NETWORK,
          amount: '100000',
          asset: USDC_ASSET,
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
        },
        payload: { payer: KNOWN_PAYER },
      });

      const handler = createRequestHandler(
        makeUptoRouteEntry(),
        async ({ charge }) => {
          await (charge as (a: string) => Promise<void>)!('0.05');
          return { settled: true };
        },
        deps,
      );
      const response = await handler(
        new Request(URL, {
          method: 'POST',
          headers: { 'X-PAYMENT': paymentHeader },
        }),
      );

      expect(response.status).toBe(200);
      expect(server.settledPayments).toHaveLength(1);
      const settled = server.settledPayments[0]!.requirements as { scheme?: string };
      expect(settled.scheme).toBe('upto');
    });

    it('an exact route rejects an upto-scheme payment (route-scoped accepts)', async () => {
      const server = new FakeX402Server();
      // A conforming facilitator returns no match when the payload's scheme is
      // absent from the server-built requirements. The default fake falls back
      // to `available[0]`, which would mask the rejection this test asserts.
      server.findMatchingRequirements = ((
        available: Array<{ network?: string; scheme?: string }>,
        payload: { accepted?: { network?: string; scheme?: string } },
      ) =>
        available.find(
          (r) => r.network === payload.accepted?.network && r.scheme === payload.accepted?.scheme,
        ) ?? null) as unknown as FakeX402Server['findMatchingRequirements'];

      // The route is `.paid()` (exact) but both accepts are configured server-wide;
      // route-scoped selection must narrow verification to the `exact` accept only.
      const deps = makeDeps(server, [
        { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
        {
          scheme: 'upto',
          network: BASE_MAINNET_NETWORK,
          payTo: KNOWN_PAYEE,
          asset: USDC_ASSET,
          decimals: 6,
          maxTimeoutSeconds: 300,
        },
      ]);

      const uptoPayment = encodePaymentSignatureHeader({
        x402Version: 2,
        resource: { url: URL, method: 'POST' },
        accepted: {
          scheme: 'upto',
          network: BASE_MAINNET_NETWORK,
          amount: '100000',
          asset: USDC_ASSET,
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
        },
        payload: { payer: KNOWN_PAYER },
      });

      const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
      const response = await handler(
        new Request(URL, { method: 'POST', headers: { 'X-PAYMENT': uptoPayment } }),
      );

      expect(response.status).toBe(402);
      expect(server.settledPayments).toHaveLength(0);
    });
  });

  describe('upto pricing (handler-driven)', () => {
    function makeUptoEntry(): RouteEntry {
      return {
        key: 'test/upto-route',
        authMode: 'paid',
        pricing: '0.10', // = maxPrice when .upTo(maxPrice)
        protocols: ['x402'],
        method: 'POST',
        billing: 'upto',
        maxPrice: '0.10',
        unitType: 'token',
      };
    }

    function makeUptoPayment(amount = '100000'): string {
      return encodePaymentSignatureHeader({
        x402Version: 2,
        resource: { url: URL, method: 'POST' },
        accepted: {
          scheme: 'upto',
          network: BASE_MAINNET_NETWORK,
          amount,
          asset: USDC_ASSET,
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
        },
        payload: { payer: KNOWN_PAYER },
      });
    }

    function makeUptoDeps(server: FakeX402Server): RouterDeps {
      return makeDeps(server, [
        {
          scheme: 'upto',
          network: BASE_MAINNET_NETWORK,
          payTo: KNOWN_PAYEE,
          asset: USDC_ASSET,
          decimals: 6,
          maxTimeoutSeconds: 300,
        },
      ]);
    }

    it('handler charge(amount) accumulates into the $-tagged settlement override', async () => {
      // Upto handlers call `charge(amount)` one or more times; the accumulated
      // total is forwarded to the x402 server as the settlement override
      // amount so Permit2Proxy settles for that amount (≤ the upto cap).
      const server = new FakeX402Server();
      const deps = makeUptoDeps(server);
      const handler = createRequestHandler(
        makeUptoEntry(),
        async ({ charge }) => {
          await (charge as (a: string) => Promise<void>)!('0.0001');
          await (charge as (a: string) => Promise<void>)!('0.0002');
          return { ok: true };
        },
        deps,
      );

      const res = await handler(
        new Request(URL, { method: 'POST', headers: { 'X-PAYMENT': makeUptoPayment() } }),
      );

      expect(res.status).toBe(200);
      expect(server.settledPayments).toHaveLength(1);
      expect(server.settledPayments[0]!.overrides).toEqual({ amount: '$0.0003' });
    });

    it('streaming on an upto route is rejected (500, no settle)', async () => {
      // x402 has no native streaming wrapper. Even if the registry has
      // streaming: true with an upto entry, dynamic-invoke rejects async
      // generator handlers cleanly (500, no settle).
      const server = new FakeX402Server();
      const deps = makeUptoDeps(server);
      const handler = createRequestHandler(
        { ...makeUptoEntry(), streaming: true },
        async function* ({ charge }) {
          await (charge as (a: string) => Promise<void>)!('0.0001');
          yield 'chunk';
        },
        deps,
      );

      const res = await handler(
        new Request(URL, { method: 'POST', headers: { 'X-PAYMENT': makeUptoPayment() } }),
      );

      expect(res.status).toBe(500);
      expect(server.settledPayments).toHaveLength(0);
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
      const result = await scheme.parsePrice('0.10', BASE_MAINNET_NETWORK);
      expect(result).toBeDefined();
      expect(result.amount).toBeDefined();
    });
  });
});
