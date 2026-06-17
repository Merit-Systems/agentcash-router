import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore, MemoryEntitlementStore } from '../src/kv-store/index.js';
import type { RouteEntry } from '../src/types.js';
import * as credential from '../src/protocols/mpp/credential.js';

vi.mock('viem/tempo', () => ({
  Transaction: {
    deserialize: vi.fn(() => ({
      from: '0xMPP_PAYER_1234567890',
      calls: [],
    })),
  },
}));

vi.mock('viem/actions', () => ({
  call: vi.fn(async () => ({})),
}));

const KNOWN_MPP_PAYER = '0xMPP_PAYER_1234567890';
const KNOWN_PAYEE = '0xPAYEE_1234567890';
const bodySchema = z.object({ query: z.string() });

const transactionCredential: credential.MppCredentialInfo = {
  credential: { payload: { type: 'transaction', signature: '0xdeadbeef' } } as never,
  wallet: KNOWN_MPP_PAYER,
  payloadType: 'transaction',
};

function createTrackingMppx(order: string[]) {
  return {
    charge: (_options: { amount: string }) => async (_input: Request) => {
      order.push('charge');
      return {
        status: 200 as const,
        withReceipt: (response: Response) => {
          const newResponse = new Response(response.body, {
            status: response.status,
            headers: response.headers,
          });
          newResponse.headers.set('Payment-Receipt', 'MOCK_MPP_RECEIPT');
          return newResponse;
        },
      };
    },
  };
}

function makeDeps(order: string[], overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'tempo:42431',
    x402Accepts: [],
    mppx: createTrackingMppx(order),
    tempoClient: {} as never,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/mpp-timing',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.02',
    protocols: ['mpp'],
    method: 'POST',
    bodySchema,
    ...overrides,
  };
}

function withMppPayment(body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { Authorization: 'Payment mock-credential' },
    ...(body && { body: JSON.stringify(body) }),
  });
}

describe('MPP transaction pull settle timing (integration)', () => {
  beforeEach(() => {
    vi.spyOn(credential, 'readMppCredential').mockReturnValue(transactionCredential);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('defers charge until after a slow handler by default', async () => {
    const order: string[] = [];
    const handler = createRequestHandler(
      makeEntry(),
      async () => {
        order.push('handler-start');
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 30_000);
        });
        order.push('handler-end');
        return { ok: true };
      },
      makeDeps(order),
    );

    const responsePromise = handler(withMppPayment({ query: 'test' }));
    await vi.advanceTimersByTimeAsync(30_000);
    const res = await responsePromise;

    expect(res.status).toBe(200);
    expect(order).toEqual(['handler-start', 'handler-end', 'charge']);
  });

  it('charges at verify before a slow handler when mpp.settleBeforeHandler is set', async () => {
    const order: string[] = [];
    const handler = createRequestHandler(
      makeEntry({ mppInfo: { settleBeforeHandler: true } }),
      async () => {
        order.push('handler-start');
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 30_000);
        });
        order.push('handler-end');
        return { ok: true };
      },
      makeDeps(order),
    );

    const responsePromise = handler(withMppPayment({ query: 'test' }));
    await vi.advanceTimersByTimeAsync(30_000);
    const res = await responsePromise;

    expect(res.status).toBe(200);
    expect(order).toEqual(['charge', 'handler-start', 'handler-end']);
  });
});
