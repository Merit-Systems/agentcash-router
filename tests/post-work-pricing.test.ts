/**
 * Tests for `.paid({ variable: true, maxPrice })` post-work pricing.
 *
 * Covers:
 *  - x402 `upto` integration: setAmount threads override into settlePayment.
 *  - MPP pull-mode integration: setAmount threads override into mppx.charge.
 *  - MPP push-mode (hash) rejection on variable routes.
 *  - Registration-time validation (maxPrice required, upto accept required).
 *  - setAmount on a non-variable paid route throws synchronously.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { createRouter } from '../src/index.js';
import type { RouteEntry, RouterPlugin } from '../src/index.js';
import type { ResolvedX402Facilitator } from '../src/x402-facilitators.js';

const BASE_NETWORK = 'eip155:8453';
const USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const URL_X402 = 'http://localhost:3000/api/test';

// Mock MPP credential decoding: we encode `{ payer, payload }` JSON in the auth
// header so the orchestrate path can read `payloadType` without a real Tempo
// transaction.
vi.mock('mppx', () => ({
  Credential: {
    fromRequest: (request: Request) => {
      const auth = request.headers.get('Authorization');
      if (!auth?.startsWith('Payment ')) return null;
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(8), 'base64').toString());
        return {
          source: payload.payer,
          challenge: {},
          payload: payload.payload ?? {},
        };
      } catch {
        return null;
      }
    },
  },
  Receipt: {
    deserialize: vi.fn(() => ({ reference: 'MOCK_TX_HASH' })),
  },
}));

vi.mock('viem/actions', () => ({
  call: vi.fn(async () => undefined),
}));

vi.mock('viem/tempo', () => ({
  Transaction: {
    deserialize: vi.fn(() => ({
      from: '0x1234567890123456789012345678901234567890',
      calls: [],
    })),
  },
}));

const KNOWN_MPP_PAYER = '0xMPP_PAYER_1234567890';

// ---------------------------------------------------------------------------
// x402 fixtures
// ---------------------------------------------------------------------------

function makeVariableEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/variable',
    authMode: 'paid',
    pricing: '0.10', // becomes maxPrice; builder sets pricing = maxPrice for variable
    variablePrice: true,
    maxPrice: '0.10',
    protocols: ['x402'],
    method: 'POST',
    ...overrides,
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

function makeX402Deps(server: FakeX402Server): OrchestrateDeps {
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
    x402Accepts: [
      { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
      {
        scheme: 'upto',
        network: BASE_NETWORK,
        payTo: KNOWN_PAYEE,
        asset: USDC_ASSET,
        decimals: 6,
        maxTimeoutSeconds: 300,
      },
    ],
  };
}

function withUptoPayment(): NextRequest {
  // Mirror how upto-scheme.test.ts builds an upto credential. The fake
  // FakeX402Server.verifyPayment recognizes any payload with `payer === KNOWN_PAYER`.
  const paymentPayload = Buffer.from(
    JSON.stringify({
      payer: KNOWN_PAYER,
      accepted: { scheme: 'upto', network: BASE_NETWORK },
    }),
  ).toString('base64');

  return new NextRequest(URL_X402, {
    method: 'POST',
    headers: { 'X-PAYMENT': paymentPayload },
  });
}

// ---------------------------------------------------------------------------
// MPP fixtures
// ---------------------------------------------------------------------------

function createFakeMppx(
  opts: {
    chargeSpy?: (amount: string) => void;
    sessionChargeCounts?: number[]; // pushes the # of stream.charge() calls per session withReceipt
  } = {},
) {
  return {
    charge: (options: { amount: string }) => async (input: Request) => {
      opts.chargeSpy?.(options.amount);
      const auth = input.headers.get('Authorization');
      if (!auth?.startsWith('Payment ')) {
        return {
          status: 402 as const,
          challenge: new Response(null, {
            status: 402,
            headers: { 'WWW-Authenticate': 'MOCK_MPP_CHALLENGE' },
          }),
        };
      }
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(8), 'base64').toString());
        if (payload.payer === KNOWN_MPP_PAYER) {
          return {
            status: 200 as const,
            withReceipt: (response: Response) => {
              const receiptResponse = new Response(response.body, {
                status: response.status,
                headers: response.headers,
              });
              receiptResponse.headers.set('Payment-Receipt', 'MOCK_MPP_RECEIPT');
              return receiptResponse;
            },
          };
        }
      } catch {
        // fallthrough
      }
      return {
        status: 402 as const,
        challenge: new Response(null, { status: 402 }),
      };
    },
    session:
      (_sessionOpts: { amount: string; unitType?: string; suggestedDeposit?: string }) =>
      async (input: Request) => {
        const auth = input.headers.get('Authorization');
        if (!auth?.startsWith('Payment ')) {
          return {
            status: 402 as const,
            challenge: new Response(null, {
              status: 402,
              headers: { 'WWW-Authenticate': 'MOCK_MPP_SESSION_CHALLENGE' },
            }),
          };
        }
        try {
          const payload = JSON.parse(Buffer.from(auth.slice(8), 'base64').toString());
          if (payload.payer !== KNOWN_MPP_PAYER) throw new Error('bad payer');
          const action = payload.payload?.action as string | undefined;
          // Mimic mppx's `respond` hook: management actions short-circuit to 204.
          const isManagementAction =
            action === 'close' ||
            action === 'topUp' ||
            ((action === 'open' || action === 'voucher') && !input.headers.get('content-length'));
          return {
            status: 200 as const,
            withReceipt: (
              response:
                | Response
                | AsyncIterable<string>
                | ((stream: { charge: () => Promise<void> }) => AsyncIterable<string>),
            ) => {
              if (isManagementAction) {
                return new Response(null, {
                  status: 204,
                  headers: { 'Payment-Receipt': 'MOCK_MPP_SESSION_ACK' },
                });
              }
              if (typeof response === 'function') {
                // Drain the generator lazily when the response body is read
                // (matches real mppx's deferred iteration). Tests must await
                // `response.text()` before asserting on `sessionChargeCounts`.
                let chargeCount = 0;
                const stream = {
                  charge: async () => {
                    chargeCount++;
                  },
                };
                const iter = response(stream);
                const body = new ReadableStream<Uint8Array>({
                  async pull(controller) {
                    let collected = '';
                    for await (const chunk of iter) collected += chunk;
                    opts.sessionChargeCounts?.push(chargeCount);
                    controller.enqueue(new TextEncoder().encode(collected));
                    controller.close();
                  },
                });
                return new Response(body, {
                  status: 200,
                  headers: {
                    'Content-Type': 'text/event-stream',
                    'Payment-Receipt': 'MOCK_MPP_SESSION_RECEIPT',
                  },
                });
              }
              if (response instanceof Response) {
                const receiptResponse = new Response(response.body, {
                  status: response.status,
                  headers: response.headers,
                });
                receiptResponse.headers.set('Payment-Receipt', 'MOCK_MPP_SESSION_RECEIPT');
                return receiptResponse;
              }
              return new Response(null, { status: 500 });
            },
          };
        } catch {
          return {
            status: 402 as const,
            challenge: new Response(null, { status: 402 }),
          };
        }
      },
  };
}

function makeMppEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/mpp-variable',
    authMode: 'paid',
    pricing: '0.10',
    variablePrice: true,
    maxPrice: '0.10',
    protocols: ['mpp'],
    method: 'POST',
    ...overrides,
  };
}

function makeMppDeps(overrides: Partial<OrchestrateDeps> = {}): OrchestrateDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'tempo:42431',
    x402Accepts: [],
    mppx: createFakeMppx() as unknown as OrchestrateDeps['mppx'],
    mppSessionConfig: { tickCost: '0.0001', unitType: 'unit' },
    tempoClient: {} as unknown as OrchestrateDeps['tempoClient'],
    ...overrides,
  };
}

function withMppSessionCredential(
  action: 'open' | 'voucher' | 'topUp' | 'close',
  body?: unknown,
): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({
      payer: KNOWN_MPP_PAYER,
      payload: {
        action,
        channelId: '0xabc',
        cumulativeAmount: '1000000',
        signature: '0xdeadbeef',
      },
    }),
  ).toString('base64');
  const headers: Record<string, string> = { Authorization: `Payment ${credential}` };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(JSON.stringify(body).length);
  }
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

function withMppCredential(payloadType: 'transaction' | 'hash' = 'transaction'): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({
      payer: KNOWN_MPP_PAYER,
      payload: { type: payloadType, signature: '0xdeadbeef' },
    }),
  ).toString('base64');
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { Authorization: `Payment ${credential}` },
    body: JSON.stringify({ q: 'hi' }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
});

describe('post-work pricing — x402 upto', () => {
  it('threads setAmount("0.05") into settlePayment as overrides', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(
      makeVariableEntry(),
      async ({ payment }) => {
        payment!.setAmount('0.05');
        return { ok: true };
      },
      makeX402Deps(server),
    );

    const response = await handler(withUptoPayment());
    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    // Bare decimals are normalized to upstream's "$0.05" dollar form before
    // being threaded into settle overrides (raw decimals would be misread as
    // atomic units by the facilitator).
    expect(server.settledPayments[0]!.overrides).toEqual({ amount: '$0.05' });
  });

  it('skips on-chain settle when handler calls setAmount("0")', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(
      makeVariableEntry(),
      async ({ payment }) => {
        payment!.setAmount('0');
        return { ok: true };
      },
      makeX402Deps(server),
    );

    const response = await handler(withUptoPayment());
    expect(response.status).toBe(200);
    // Upstream upto treats amount=0 as a legal no-op. The fake mirrors that
    // by returning an empty transaction string for overrides.amount === '0'.
    expect(server.settledPayments).toHaveLength(1);
    expect(server.settledPayments[0]!.overrides).toEqual({ amount: '0' });
  });

  it('settles at maxPrice when handler does not call setAmount', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(
      makeVariableEntry(),
      async () => ({ ok: true }),
      makeX402Deps(server),
    );

    const response = await handler(withUptoPayment());
    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    // No override forwarded → upstream uses requirements.amount (== maxPrice).
    expect(server.settledPayments[0]!.overrides).toBeUndefined();
  });

  it('last setAmount call wins', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(
      makeVariableEntry(),
      async ({ payment }) => {
        payment!.setAmount('0.05');
        payment!.setAmount('0.07');
        return { ok: true };
      },
      makeX402Deps(server),
    );

    const response = await handler(withUptoPayment());
    expect(response.status).toBe(200);
    expect(server.settledPayments[0]!.overrides).toEqual({ amount: '$0.07' });
  });

  it('does not grant SIWX entitlement when effective amount is 0', async () => {
    const server = new FakeX402Server();
    const entitlementStore = new MemoryEntitlementStore();
    const grantSpy = vi.spyOn(entitlementStore, 'grant');

    const handler = createRequestHandler(
      makeVariableEntry({ siwxEnabled: true }),
      async ({ payment }) => {
        payment!.setAmount('0');
        return { ok: true };
      },
      { ...makeX402Deps(server), entitlementStore },
    );

    const response = await handler(withUptoPayment());
    expect(response.status).toBe(200);
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('filters out exact accepts on variable routes — challenges only advertise override-capable schemes', async () => {
    // Regression: when CDP /accepts 401s and only `exact` survives the
    // facilitator enrichment, agentcash signs an exact payment for maxPrice
    // and the server tries to apply setAmount() override on settle —
    // upstream rejects with `invalid_exact_evm_payload_authorization_value`.
    // Variable routes must never advertise exact in the first place.
    await import('vitest').then(async ({ vi: _vi }) => {
      // pass-through facilitator like upto-scheme.test.ts uses
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { accepts?: unknown[] };
        return new Response(JSON.stringify({ accepts: body.accepts ?? [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch;
      try {
        const server = new FakeX402Server();
        const handler = createRequestHandler(
          makeVariableEntry(),
          async () => ({ ok: true }),
          makeX402Deps(server),
        );

        const response = await handler(
          new NextRequest(URL_X402, { method: 'POST' }), // no payment → 402 challenge
        );
        expect(response.status).toBe(402);

        const encoded = response.headers.get('PAYMENT-REQUIRED')!;
        const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
        const schemes = (challenge.accepts as Array<{ scheme: string }>).map((a) => a.scheme);
        expect(schemes).toContain('upto');
        expect(schemes).not.toContain('exact');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it('reports the effective amount in onPaymentSettled', async () => {
    const server = new FakeX402Server();
    const settled = vi.fn();
    const plugin: RouterPlugin = { onPaymentSettled: settled };

    const handler = createRequestHandler(
      makeVariableEntry(),
      async ({ payment }) => {
        payment!.setAmount('0.07');
        return { ok: true };
      },
      { ...makeX402Deps(server), plugin },
    );

    await handler(withUptoPayment());
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled.mock.calls[0]![1]).toMatchObject({
      protocol: 'x402',
      amount: '0.07',
    });
  });
});

describe('post-work pricing — non-variable paid routes', () => {
  it('throws synchronously when handler calls setAmount on a non-variable paid route', async () => {
    const server = new FakeX402Server();
    let caught: unknown;
    const handler = createRequestHandler(
      // No `variablePrice: true` — calling setAmount must throw inside the handler.
      {
        key: 'test/static',
        authMode: 'paid',
        pricing: '0.02',
        protocols: ['x402'],
        method: 'POST',
      },
      async ({ payment }) => {
        try {
          payment!.setAmount('0.01');
        } catch (err) {
          caught = err;
          throw err;
        }
        return { ok: true };
      },
      makeX402Deps(server),
    );

    const response = await handler(withUptoPayment());
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/variable: true/);
    // Handler threw → safeCallHandler returns 500 and orchestrate skips settle.
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(server.settledPayments).toHaveLength(0);
  });
});

describe('post-work pricing — MPP', () => {
  // Variable + MPP routes require a session credential. Pull-mode (transaction)
  // and push-mode (hash) charge credentials are both rejected because they
  // commit the client to a fixed amount before the handler runs.

  it('rejects pull-mode (transaction-payload) charge credentials on variable routes', async () => {
    const handler = createRequestHandler(
      makeMppEntry(),
      // Handler must not run — the route should reject the credential before
      // invoking it.
      async () => {
        throw new Error('handler should not have been invoked');
      },
      makeMppDeps(),
    );

    const response = await handler(withMppCredential('transaction'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/session credential/i);
  });

  it('rejects push-mode (hash-payload) charge credentials on variable routes', async () => {
    const alertSpy = vi.fn();
    const plugin: RouterPlugin = { onAlert: alertSpy };
    const handler = createRequestHandler(
      makeMppEntry(),
      async () => {
        throw new Error('handler should not have been invoked');
      },
      { ...makeMppDeps(), plugin },
    );

    const response = await handler(withMppCredential('hash'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/session credential/i);
    expect(alertSpy).toHaveBeenCalled();
    const alerts = alertSpy.mock.calls.map((c) => c[1]);
    expect(alerts.some((a) => a.level === 'warn' && /charge credential/i.test(a.message))).toBe(
      true,
    );
  });

  it('handles a session voucher credential by emitting an SSE response with N ticks', async () => {
    const sessionChargeCounts: number[] = [];
    const fakeMppx = createFakeMppx({ sessionChargeCounts });
    const handler = createRequestHandler(
      makeMppEntry(),
      async ({ payment }) => {
        // Post-work amount = 0.034. tickCost = 0.0001 → 340 ticks.
        payment!.setAmount('0.034');
        return { fortune: 'pay-as-you-go' };
      },
      makeMppDeps({ mppx: fakeMppx as unknown as OrchestrateDeps['mppx'] }),
    );

    const response = await handler(withMppSessionCredential('voucher', { mood: 'long' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/event-stream/);
    expect(response.headers.get('Payment-Receipt')).toBe('MOCK_MPP_SESSION_RECEIPT');
    // Drain the body so the fake's lazy generator runs.
    await response.text();
    // 0.034 / 0.0001 = 340 ticks.
    expect(sessionChargeCounts).toEqual([340]);
  });

  it('charges ceil(maxPrice / tickCost) ticks when the handler does not call setAmount', async () => {
    const sessionChargeCounts: number[] = [];
    const fakeMppx = createFakeMppx({ sessionChargeCounts });
    const handler = createRequestHandler(
      makeMppEntry({ maxPrice: '0.05' }),
      async () => ({ ok: true }),
      makeMppDeps({ mppx: fakeMppx as unknown as OrchestrateDeps['mppx'] }),
    );

    const response = await handler(withMppSessionCredential('voucher', {}));
    expect(response.status).toBe(200);
    await response.text();
    // 0.05 / 0.0001 = 500 ticks.
    expect(sessionChargeCounts).toEqual([500]);
  });

  it('does not charge ticks when the handler returns an error response', async () => {
    const sessionChargeCounts: number[] = [];
    const fakeMppx = createFakeMppx({ sessionChargeCounts });
    const handler = createRequestHandler(
      makeMppEntry(),
      async () => {
        // Simulate a handler that throws after partial work — orchestrate's
        // safeCallHandler will turn this into a 500.
        throw new Error('handler exploded');
      },
      makeMppDeps({ mppx: fakeMppx as unknown as OrchestrateDeps['mppx'] }),
    );

    const response = await handler(withMppSessionCredential('voucher', {}));
    expect(response.status).toBeGreaterThanOrEqual(500);
    // The error path skips the SSE generator entirely — no ticks charged.
    expect(sessionChargeCounts).toEqual([]);
  });

  it('returns 204 for management actions (close) without invoking the handler', async () => {
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const handler = createRequestHandler(makeMppEntry(), handlerSpy, makeMppDeps());

    const response = await handler(withMppSessionCredential('close'));
    expect(response.status).toBe(204);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('issues a session 402 challenge when no credential is present (variable route)', async () => {
    const handler = createRequestHandler(makeMppEntry(), async () => ({ ok: true }), makeMppDeps());

    const response = await handler(
      new NextRequest('http://localhost:3000/api/test', { method: 'POST' }),
    );
    expect(response.status).toBe(402);
    expect(response.headers.get('WWW-Authenticate')).toBe('MOCK_MPP_SESSION_CHALLENGE');
  });

  it('returns 500 with a clear error when a session credential arrives but session is not configured', async () => {
    const fakeMppx = createFakeMppx();
    const handler = createRequestHandler(
      makeMppEntry(),
      async () => ({ ok: true }),
      makeMppDeps({
        mppx: fakeMppx as unknown as OrchestrateDeps['mppx'],
        mppSessionConfig: null,
      }),
    );

    const response = await handler(withMppSessionCredential('voucher', {}));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/session not configured/i);
  });
});

// ---------------------------------------------------------------------------
// Registration-time validation (uses the real builder via createRouter)
// ---------------------------------------------------------------------------

describe('post-work pricing — registration', () => {
  it('rejects .paid({ variable: true }) without maxPrice', () => {
    const router = createRouter({
      payeeAddress: KNOWN_PAYEE,
      baseUrl: 'http://localhost:3000',
      x402: {
        accepts: [{ scheme: 'upto', network: BASE_NETWORK, asset: USDC_ASSET, decimals: 6 }],
      },
      discovery: { title: 'test', version: '0.0.0' },
    });

    expect(() => {
      router
        .route('test/missing-max')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .paid({ variable: true } as any)
        .handler(async () => ({ ok: true }));
    }).toThrow(/maxPrice/);
  });

  it('rejects variable: true on x402 routes without an `upto` accept', () => {
    const router = createRouter({
      payeeAddress: KNOWN_PAYEE,
      baseUrl: 'http://localhost:3000',
      x402: {
        // Only `exact` — no upto means the router can't honor post-work overrides on x402.
        accepts: [{ scheme: 'exact', network: BASE_NETWORK }],
      },
      discovery: { title: 'test', version: '0.0.0' },
    });

    expect(() => {
      router
        .route('test/no-upto')
        .paid({ variable: true, maxPrice: '0.10' })
        .body(z.object({ q: z.string() }))
        .handler(async () => ({ ok: true }));
    }).toThrow(/upto/);
  });

  it('rejects variable: true combined with tiered pricing', () => {
    const router = createRouter({
      payeeAddress: KNOWN_PAYEE,
      baseUrl: 'http://localhost:3000',
      x402: {
        accepts: [{ scheme: 'upto', network: BASE_NETWORK, asset: USDC_ASSET, decimals: 6 }],
      },
      discovery: { title: 'test', version: '0.0.0' },
    });

    expect(() => {
      router
        .route('test/tiered-variable')
        .paid(
          {
            field: 'tier',
            tiers: { basic: { price: '0.01' } },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { variable: true, maxPrice: '0.10' } as any,
        )
        .body(z.object({ tier: z.string() }))
        .handler(async () => ({ ok: true }));
    }).toThrow(/tiered/);
  });

  it('accepts variable: true when an upto accept is configured', () => {
    const router = createRouter({
      payeeAddress: KNOWN_PAYEE,
      baseUrl: 'http://localhost:3000',
      x402: {
        accepts: [
          { scheme: 'exact', network: BASE_NETWORK },
          { scheme: 'upto', network: BASE_NETWORK, asset: USDC_ASSET, decimals: 6 },
        ],
      },
      discovery: { title: 'test', version: '0.0.0' },
    });

    expect(() => {
      router
        .route('test/llm')
        .paid({ variable: true, maxPrice: '0.10' })
        .handler(async () => ({ ok: true }));
    }).not.toThrow();

    const entry = router.registry.get('test/llm');
    expect(entry?.variablePrice).toBe(true);
    expect(entry?.maxPrice).toBe('0.10');
  });
});
