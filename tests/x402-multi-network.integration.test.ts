import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import type { RouteEntry } from '../src/types.js';

const BASE_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';
const SOLANA_SETTLEMENT_SCHEME = '@faremeter/x-solana-settlement';
const URL = 'http://localhost:3000/api/test';

function makeEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    pricing: '0.02',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeDeps(server: FakeX402Server): OrchestrateDeps {
  return {
    x402Server: server as unknown as OrchestrateDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_NETWORK,
    facilitatorUrl: undefined,
    x402Accepts: [
      { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
      { scheme: 'exact', network: SOLANA_NETWORK, payTo: SOLANA_PAYEE },
    ],
  };
}

function makePaymentRequest(
  network: string,
  payTo: string,
  scheme = 'exact',
  asset = 'mock-usdc',
  extra?: Record<string, unknown>,
): NextRequest {
  const paymentHeader = encodePaymentSignatureHeader({
    x402Version: 2,
    resource: { url: URL, method: 'POST' },
    accepted: {
      scheme,
      network,
      amount: '0.02',
      asset,
      payTo,
      maxTimeoutSeconds: 300,
      ...(extra ? { extra } : {}),
    },
    payload: {
      payer: KNOWN_PAYER,
    },
  });

  return new NextRequest(URL, {
    method: 'POST',
    headers: {
      'PAYMENT-SIGNATURE': paymentHeader,
    },
  });
}

class RotatingExtraX402Server extends FakeX402Server {
  private buildCount = 0;

  override buildPaymentRequirementsFromOptions(
    options: Array<{ price: string; payTo: string; scheme: string; network: string }>,
    ctx: unknown,
  ) {
    this.buildCount += 1;
    const requirements = super.buildPaymentRequirementsFromOptions(options, ctx) as Array<
      Record<string, unknown>
    >;
    return requirements.map((requirement) => ({
      ...requirement,
      extra: { feePayer: `fee-payer-${this.buildCount}` },
    }));
  }

  override async verifyPayment(payload: unknown, requirements: unknown) {
    const acceptedFeePayer = (payload as { accepted?: { extra?: { feePayer?: string } } } | null)
      ?.accepted?.extra?.feePayer;
    const requirementFeePayer = (requirements as { extra?: { feePayer?: string } } | null)?.extra
      ?.feePayer;

    if (acceptedFeePayer !== requirementFeePayer) {
      return { isValid: false, payer: null };
    }

    return super.verifyPayment(payload, requirements);
  }
}

describe('x402 multi-network integration', () => {
  it('emits one PAYMENT-REQUIRED challenge advertising both Base and Solana', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await handler(new NextRequest(URL, { method: 'POST' }));

    expect(response.status).toBe(402);

    const header = response.headers.get('PAYMENT-REQUIRED');
    expect(header).toBeTruthy();

    const challenge = decodePaymentRequiredHeader(header!);
    expect(challenge.accepts).toHaveLength(2);
    expect(challenge.accepts.map((accept) => accept.network)).toEqual([
      BASE_NETWORK,
      SOLANA_NETWORK,
    ]);
    expect(challenge.accepts.map((accept) => accept.payTo)).toEqual([KNOWN_PAYEE, SOLANA_PAYEE]);
  });

  it('matches and settles the Base requirement when the client selects Base', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await handler(makePaymentRequest(BASE_NETWORK, KNOWN_PAYEE));

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect((server.settledPayments[0]?.requirements as { network?: string })?.network).toBe(
      BASE_NETWORK,
    );

    const paymentResponse = decodePaymentResponseHeader(response.headers.get('PAYMENT-RESPONSE')!);
    expect(paymentResponse.network).toBe(BASE_NETWORK);
  });

  it('matches and settles the Solana requirement when the client selects Solana', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await handler(makePaymentRequest(SOLANA_NETWORK, SOLANA_PAYEE));

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect((server.settledPayments[0]?.requirements as { network?: string })?.network).toBe(
      SOLANA_NETWORK,
    );
    expect((server.settledPayments[0]?.requirements as { payTo?: string })?.payTo).toBe(
      SOLANA_PAYEE,
    );

    const paymentResponse = decodePaymentResponseHeader(response.headers.get('PAYMENT-RESPONSE')!);
    expect(paymentResponse.network).toBe(SOLANA_NETWORK);
  });

  it('supports one route with multiple Solana payment options', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402Accepts = [
      { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
      { scheme: 'exact', network: SOLANA_NETWORK, payTo: SOLANA_PAYEE },
      {
        scheme: SOLANA_SETTLEMENT_SCHEME,
        network: SOLANA_NETWORK,
        payTo: SOLANA_PAYEE,
        asset: 'solana-usdc',
        decimals: 6,
        maxTimeoutSeconds: 60,
      },
    ];

    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
    const challengeResponse = await handler(new NextRequest(URL, { method: 'POST' }));
    const challenge = decodePaymentRequiredHeader(
      challengeResponse.headers.get('PAYMENT-REQUIRED')!,
    );

    expect(challenge.accepts).toHaveLength(3);
    expect(
      challenge.accepts.map((accept) => ({ scheme: accept.scheme, network: accept.network })),
    ).toEqual([
      { scheme: 'exact', network: BASE_NETWORK },
      { scheme: 'exact', network: SOLANA_NETWORK },
      { scheme: SOLANA_SETTLEMENT_SCHEME, network: SOLANA_NETWORK },
    ]);

    const settlementAccept = challenge.accepts.find(
      (accept) => accept.scheme === SOLANA_SETTLEMENT_SCHEME,
    );
    expect(settlementAccept).toMatchObject({
      asset: 'solana-usdc',
      amount: '20000',
      maxTimeoutSeconds: 60,
      payTo: SOLANA_PAYEE,
    });

    const response = await handler(
      makePaymentRequest(SOLANA_NETWORK, SOLANA_PAYEE, SOLANA_SETTLEMENT_SCHEME, 'solana-usdc'),
    );

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect(
      (
        server.settledPayments[0]?.requirements as {
          scheme?: string;
          network?: string;
          asset?: string;
        }
      )?.scheme,
    ).toBe(SOLANA_SETTLEMENT_SCHEME);
    expect(
      (
        server.settledPayments[0]?.requirements as {
          scheme?: string;
          network?: string;
          asset?: string;
        }
      )?.network,
    ).toBe(SOLANA_NETWORK);
    expect(
      (
        server.settledPayments[0]?.requirements as {
          scheme?: string;
          network?: string;
          asset?: string;
        }
      )?.asset,
    ).toBe('solana-usdc');
  });

  it('enriches custom-scheme challenge requirements through facilitator /accepts', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.facilitatorUrl = 'https://facilitator.example';
    deps.x402Accepts = [
      { scheme: 'exact', network: BASE_NETWORK, payTo: KNOWN_PAYEE },
      {
        scheme: SOLANA_SETTLEMENT_SCHEME,
        network: SOLANA_NETWORK,
        payTo: SOLANA_PAYEE,
        asset: 'solana-usdc',
        decimals: 6,
        maxTimeoutSeconds: 60,
      },
    ];

    const originalFetch = globalThis.fetch;
    const acceptsResponse = {
      x402Version: 2,
      resource: { url: URL, method: 'POST', mimeType: 'application/json' },
      accepts: [
        {
          scheme: 'exact',
          network: BASE_NETWORK,
          amount: '0.02',
          asset: 'mock-usdc',
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
          extra: {},
        },
        {
          scheme: SOLANA_SETTLEMENT_SCHEME,
          network: SOLANA_NETWORK,
          amount: '20000',
          asset: 'solana-usdc',
          payTo: SOLANA_PAYEE,
          maxTimeoutSeconds: 60,
          extra: {
            admin: 'admin-pubkey',
            recentBlockhash: 'recent-blockhash',
          },
        },
      ],
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(acceptsResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
      const response = await handler(new NextRequest(URL, { method: 'POST' }));
      const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
      const settlementAccept = challenge.accepts.find(
        (accept) => accept.scheme === SOLANA_SETTLEMENT_SCHEME,
      );

      expect(fetchMock).toHaveBeenCalledWith('https://facilitator.example/accepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: expect.any(String),
      });
      expect(settlementAccept).toMatchObject({
        scheme: SOLANA_SETTLEMENT_SCHEME,
        network: SOLANA_NETWORK,
        extra: {
          admin: 'admin-pubkey',
          recentBlockhash: 'recent-blockhash',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('enriches Solana exact challenge requirements through facilitator /accepts', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.facilitatorUrl = 'https://facilitator.example';

    const originalFetch = globalThis.fetch;
    const acceptsResponse = {
      x402Version: 2,
      resource: { url: URL, method: 'POST', mimeType: 'application/json' },
      accepts: [
        {
          scheme: 'exact',
          network: BASE_NETWORK,
          amount: '0.02',
          asset: 'mock-usdc',
          payTo: KNOWN_PAYEE,
          maxTimeoutSeconds: 300,
          extra: {},
        },
        {
          scheme: 'exact',
          network: SOLANA_NETWORK,
          amount: '0.02',
          asset: 'mock-usdc',
          payTo: SOLANA_PAYEE,
          maxTimeoutSeconds: 300,
          extra: {
            feePayer: 'fee-payer',
            recentBlockhash: 'recent-blockhash',
            features: {
              xSettlementAccountSupported: true,
            },
          },
        },
      ],
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(acceptsResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
      const response = await handler(new NextRequest(URL, { method: 'POST' }));
      const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
      const solanaAccept = challenge.accepts.find(
        (accept) => accept.scheme === 'exact' && accept.network === SOLANA_NETWORK,
      );

      expect(fetchMock).toHaveBeenCalledWith('https://facilitator.example/accepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: expect.any(String),
      });
      expect(solanaAccept).toMatchObject({
        scheme: 'exact',
        network: SOLANA_NETWORK,
        extra: {
          feePayer: 'fee-payer',
          recentBlockhash: 'recent-blockhash',
          features: {
            xSettlementAccountSupported: true,
          },
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('verifies against the client accepted requirement when facilitator extras rotate', async () => {
    const server = new RotatingExtraX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const challengeResponse = await handler(new NextRequest(URL, { method: 'POST' }));
    const challenge = decodePaymentRequiredHeader(
      challengeResponse.headers.get('PAYMENT-REQUIRED')!,
    );
    const solanaRequirement = challenge.accepts.find((accept) => accept.network === SOLANA_NETWORK);

    expect(solanaRequirement).toBeTruthy();

    const response = await handler(
      makePaymentRequest(
        SOLANA_NETWORK,
        SOLANA_PAYEE,
        'exact',
        'mock-usdc',
        (solanaRequirement?.extra as Record<string, unknown> | undefined) ?? undefined,
      ),
    );

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect(
      (
        server.settledPayments[0]?.requirements as {
          extra?: { feePayer?: string };
        }
      )?.extra?.feePayer,
    ).toBe((solanaRequirement?.extra as { feePayer?: string } | undefined)?.feePayer);
  });
});
