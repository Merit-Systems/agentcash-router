import { describe, expect, it, vi } from 'vitest';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore } from '../src/kv-store/index.js';
import { MemoryEntitlementStore } from '../src/kv-store/index.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import type { RouteEntry } from '../src/types.js';
import type { ResolvedX402Facilitator } from '../src/protocols/x402/facilitators.js';

interface SettledRequirements {
  scheme?: string;
  network?: string;
  payTo?: string;
  asset?: string;
  extra?: Record<string, unknown>;
}

function settledReqs(server: FakeX402Server, index = 0): SettledRequirements | undefined {
  return server.settledPayments[index]?.requirements as SettledRequirements | undefined;
}

const BASE_MAINNET_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';
const SOLANA_SETTLEMENT_SCHEME = '@faremeter/x-solana-settlement';
const URL = 'http://localhost:3000/api/test';

function makeEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.02',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeDeps(server: FakeX402Server): RouterDeps {
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_MAINNET_NETWORK,
    x402FacilitatorsByNetwork: {
      [SOLANA_NETWORK]: makeFacilitator(SOLANA_NETWORK, 'https://facilitator.example'),
    },
    x402Accepts: [
      { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
      { scheme: 'exact', network: SOLANA_NETWORK, payTo: SOLANA_PAYEE },
    ],
  };
}

function makeFacilitator(
  network: string,
  url: string,
  overrides: Partial<ResolvedX402Facilitator['config']> = {},
): ResolvedX402Facilitator {
  return {
    family: network.startsWith('solana:') ? 'solana' : 'evm',
    network: network as ResolvedX402Facilitator['network'],
    url,
    config: {
      url,
      ...overrides,
    },
  };
}

function makePaymentRequest(
  network: string,
  payTo: string,
  scheme = 'exact',
  asset = 'mock-usdc',
  extra?: Record<string, unknown>,
): Request {
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

  return new Request(URL, {
    method: 'POST',
    headers: {
      'PAYMENT-SIGNATURE': paymentHeader,
    },
  });
}

async function withFetchMock<T>(
  response: unknown,
  run: (fetchMock: ReturnType<typeof vi.fn>) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  globalThis.fetch = fetchMock as typeof fetch;
  try {
    return await run(fetchMock);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withPassThroughFacilitatorAccepts<T>(
  run: (fetchMock: ReturnType<typeof vi.fn>) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { accepts?: unknown[] };
    return new Response(JSON.stringify({ accepts: body.accepts ?? [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  globalThis.fetch = fetchMock as typeof fetch;
  try {
    return await run(fetchMock);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
      return { isValid: false };
    }

    return super.verifyPayment(payload, requirements);
  }
}

class SolanaExactFailureX402Server extends FakeX402Server {
  override buildPaymentRequirementsFromOptions(
    options: Array<{ price: string; payTo: string; scheme: string; network: string }>,
    ctx: unknown,
  ) {
    if (options.some((option) => option.network === SOLANA_NETWORK)) {
      throw new Error('Facilitator does not support exact on Solana');
    }
    return super.buildPaymentRequirementsFromOptions(options, ctx);
  }
}

describe('x402 multi-network integration', () => {
  it('emits one PAYMENT-REQUIRED challenge advertising both Base and Solana', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await withPassThroughFacilitatorAccepts(() =>
      handler(new Request(URL, { method: 'POST' })),
    );

    expect(response.status).toBe(402);

    const header = response.headers.get('PAYMENT-REQUIRED');
    expect(header).toBeTruthy();

    const challenge = decodePaymentRequiredHeader(header!);
    expect(challenge.accepts).toHaveLength(2);
    expect(challenge.accepts.map((accept) => accept.network)).toEqual([
      BASE_MAINNET_NETWORK,
      SOLANA_NETWORK,
    ]);
    expect(challenge.accepts.map((accept) => accept.payTo)).toEqual([KNOWN_PAYEE, SOLANA_PAYEE]);
  });

  it('still emits a Base challenge when Solana exact requirement building fails', async () => {
    const server = new SolanaExactFailureX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await withPassThroughFacilitatorAccepts(() =>
      handler(new Request(URL, { method: 'POST' })),
    );

    expect(response.status).toBe(402);

    const header = response.headers.get('PAYMENT-REQUIRED');
    expect(header).toBeTruthy();

    const challenge = decodePaymentRequiredHeader(header!);
    expect(challenge.accepts).toHaveLength(1);
    expect(challenge.accepts[0]).toMatchObject({
      network: BASE_MAINNET_NETWORK,
      payTo: KNOWN_PAYEE,
    });
  });

  it('matches and settles the Base requirement when the client selects Base', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await handler(makePaymentRequest(BASE_MAINNET_NETWORK, KNOWN_PAYEE));

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect(settledReqs(server)?.network).toBe(BASE_MAINNET_NETWORK);

    const paymentResponse = decodePaymentResponseHeader(response.headers.get('PAYMENT-RESPONSE')!);
    expect(paymentResponse.network).toBe(BASE_MAINNET_NETWORK);
  });

  it('matches and settles the Solana requirement when the client selects Solana', async () => {
    const server = new FakeX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const response = await handler(makePaymentRequest(SOLANA_NETWORK, SOLANA_PAYEE));

    expect(response.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect(settledReqs(server)?.network).toBe(SOLANA_NETWORK);
    expect(settledReqs(server)?.payTo).toBe(SOLANA_PAYEE);

    const paymentResponse = decodePaymentResponseHeader(response.headers.get('PAYMENT-RESPONSE')!);
    expect(paymentResponse.network).toBe(SOLANA_NETWORK);
  });

  it('supports one route with multiple Solana payment options', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402Accepts = [
      { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
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
    const challengeResponse = await withPassThroughFacilitatorAccepts(() =>
      handler(new Request(URL, { method: 'POST' })),
    );
    const challenge = decodePaymentRequiredHeader(
      challengeResponse.headers.get('PAYMENT-REQUIRED')!,
    );

    expect(challenge.accepts).toHaveLength(3);
    expect(
      challenge.accepts.map((accept) => ({ scheme: accept.scheme, network: accept.network })),
    ).toEqual([
      { scheme: 'exact', network: BASE_MAINNET_NETWORK },
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
    expect(settledReqs(server)?.scheme).toBe(SOLANA_SETTLEMENT_SCHEME);
    expect(settledReqs(server)?.network).toBe(SOLANA_NETWORK);
    expect(settledReqs(server)?.asset).toBe('solana-usdc');
  });

  it('enriches custom-scheme challenge requirements through facilitator /accepts', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402FacilitatorsByNetwork = {
      [BASE_MAINNET_NETWORK]: makeFacilitator(BASE_MAINNET_NETWORK, 'https://cdp.example'),
      [SOLANA_NETWORK]: makeFacilitator(SOLANA_NETWORK, 'https://facilitator.example'),
    };
    deps.x402Accepts = [
      { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
      {
        scheme: SOLANA_SETTLEMENT_SCHEME,
        network: SOLANA_NETWORK,
        payTo: SOLANA_PAYEE,
        asset: 'solana-usdc',
        decimals: 6,
        maxTimeoutSeconds: 60,
      },
    ];

    const enrichedExtra = { admin: 'admin-pubkey', recentBlockhash: 'recent-blockhash' };
    await withFetchMock(
      {
        accepts: [
          {
            scheme: SOLANA_SETTLEMENT_SCHEME,
            network: SOLANA_NETWORK,
            amount: '20000',
            asset: 'solana-usdc',
            payTo: SOLANA_PAYEE,
            maxTimeoutSeconds: 60,
            extra: enrichedExtra,
          },
        ],
      },
      async (fetchMock) => {
        const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
        const response = await handler(new Request(URL, { method: 'POST' }));
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
          extra: enrichedExtra,
        });
      },
    );
  });

  it('enriches Solana exact challenge requirements through facilitator /accepts', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402FacilitatorsByNetwork = {
      [BASE_MAINNET_NETWORK]: makeFacilitator(BASE_MAINNET_NETWORK, 'https://cdp.example'),
      [SOLANA_NETWORK]: makeFacilitator(SOLANA_NETWORK, 'https://facilitator.example'),
    };

    const enrichedExtra = {
      feePayer: 'fee-payer',
      recentBlockhash: 'recent-blockhash',
      features: { xSettlementAccountSupported: true },
    };
    await withFetchMock(
      {
        accepts: [
          {
            scheme: 'exact',
            network: SOLANA_NETWORK,
            amount: '0.02',
            asset: 'mock-usdc',
            payTo: SOLANA_PAYEE,
            maxTimeoutSeconds: 300,
            extra: enrichedExtra,
          },
        ],
      },
      async (fetchMock) => {
        const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
        const response = await handler(new Request(URL, { method: 'POST' }));
        const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
        const solanaAccept = challenge.accepts.find(
          (accept) => accept.scheme === 'exact' && accept.network === SOLANA_NETWORK,
        );

        expect(fetchMock).toHaveBeenCalledWith('https://facilitator.example/accepts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: expect.any(String),
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(solanaAccept).toMatchObject({
          scheme: 'exact',
          network: SOLANA_NETWORK,
          extra: enrichedExtra,
        });
      },
    );
  });

  it('maps /accepts enrichment by (scheme, network) when the facilitator reorders its response', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402FacilitatorsByNetwork = {
      [SOLANA_NETWORK]: makeFacilitator(SOLANA_NETWORK, 'https://facilitator.example'),
    };
    deps.x402Accepts = [
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

    // Reordering fake facilitator: echoes the requested requirements back in
    // REVERSE order, each tagged with scheme-specific enrichment.
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        accepts?: Array<Record<string, unknown>>;
      };
      const reversed = [...(body.accepts ?? [])].reverse().map((requirement) => ({
        ...requirement,
        extra: { enrichedFor: requirement.scheme },
      }));
      return new Response(JSON.stringify({ accepts: reversed }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
      const response = await handler(new Request(URL, { method: 'POST' }));
      const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(challenge.accepts).toHaveLength(2);
      // Each requirement must receive ITS OWN enrichment despite the reorder.
      const exactAccept = challenge.accepts.find((accept) => accept.scheme === 'exact');
      const settlementAccept = challenge.accepts.find(
        (accept) => accept.scheme === SOLANA_SETTLEMENT_SCHEME,
      );
      expect(exactAccept?.extra).toMatchObject({ enrichedFor: 'exact' });
      expect(settlementAccept?.extra).toMatchObject({ enrichedFor: SOLANA_SETTLEMENT_SCHEME });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses facilitator auth headers for /accepts enrichment', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server);
    deps.x402FacilitatorsByNetwork = {
      [SOLANA_NETWORK]: makeFacilitator(SOLANA_NETWORK, 'https://facilitator.example', {
        createAcceptsHeaders: async () => ({
          authorization: 'Bearer accepts-token',
        }),
      }),
    };

    await withFetchMock({ accepts: [] }, async (fetchMock) => {
      const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), deps);
      await handler(new Request(URL, { method: 'POST' }));

      expect(fetchMock).toHaveBeenCalledWith('https://facilitator.example/accepts', {
        method: 'POST',
        headers: {
          authorization: 'Bearer accepts-token',
          'content-type': 'application/json',
        },
        body: expect.any(String),
      });
    });
  });

  it('verifies against the client accepted requirement when facilitator extras rotate', async () => {
    const server = new RotatingExtraX402Server();
    const handler = createRequestHandler(makeEntry(), async () => ({ ok: true }), makeDeps(server));

    const challengeResponse = await withPassThroughFacilitatorAccepts(() =>
      handler(new Request(URL, { method: 'POST' })),
    );
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
    expect(settledReqs(server)?.extra?.feePayer).toBe(
      (solanaRequirement?.extra as { feePayer?: string } | undefined)?.feePayer,
    );
  });
});
