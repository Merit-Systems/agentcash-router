import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { z } from 'zod';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore } from '../src/kv-store/index.js';
import { MemoryEntitlementStore } from '../src/kv-store/index.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { withX402Payment } from './fakes/request.js';
import type {
  HandlerContext,
  HandlerPaymentContext,
  RouteEntry,
  SettlementErrorContext,
  SettlementLifecycleContext,
  SettlementSettledContext,
  SettledHandlerErrorContext,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// Mock the protocol modules to use our fakes
// ---------------------------------------------------------------------------

// Mock x402 protocol modules to use FakeX402Server directly
vi.mock('../src/protocols/x402/challenge.js', () => ({
  buildX402Challenge: ({
    server,
    request,
    price,
    accepts,
    extensions,
  }: {
    server: FakeX402Server;
    routeEntry: RouteEntry;
    request: Request;
    price: string;
    accepts: Array<{ network: string; payTo: string }>;
    facilitatorsByNetwork?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
  }) => {
    const requirements = server.buildPaymentRequirementsFromOptions(
      accepts.map(({ network, payTo }) => ({ price, payTo, scheme: 'exact', network })),
      { request },
    );
    const paymentRequired = server.createPaymentRequiredResponse(
      requirements,
      {},
      null,
      extensions,
    );
    return {
      encoded: Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
      requirements,
    };
  },
}));

vi.mock('../src/protocols/x402/verify.js', () => ({
  verifyX402Payment: async ({
    server,
    request,
    price,
    accepts,
  }: {
    server: FakeX402Server;
    request: Request;
    routeEntry: RouteEntry;
    price: string;
    accepts: Array<{ network: string; payTo: string }>;
  }) => {
    const paymentHeader =
      request.headers.get('PAYMENT-SIGNATURE') ?? request.headers.get('X-PAYMENT');
    if (!paymentHeader) return null;

    let payload: { payer: string; amount: string; network?: string };
    try {
      payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    } catch {
      return { valid: false, payload: null, requirements: null, payer: null };
    }

    const requirements = server.buildPaymentRequirementsFromOptions(
      accepts.map(({ network, payTo }) => ({ price, payTo, scheme: 'exact', network })),
      { request },
    );
    const matching =
      requirements.find((requirement) => requirement.network === payload.network) ??
      requirements[0];
    const verify = await server.verifyPayment(payload, matching);
    if (!verify.isValid) {
      return { valid: false, payload: null, requirements: null, payer: null };
    }

    return {
      valid: true,
      payer: verify.payer as string,
      payload,
      requirements: matching,
    };
  },
}));

vi.mock('../src/protocols/x402/settle.js', () => ({
  settleX402Payment: async (server: FakeX402Server, payload: unknown, requirements: unknown) => {
    const result = await server.settlePayment(payload, requirements);
    return { encoded: 'SETTLE_' + result.transaction, result };
  },
}));

// Mock SIWX to bypass real @x402/extensions
vi.mock('../src/auth/siwx.js', () => ({
  verifySIWX: async (request: Request, _routeEntry: RouteEntry, nonceStore: MemoryNonceStore) => {
    const header = request.headers.get('SIGN-IN-WITH-X');
    if (!header) return { valid: false, wallet: null, code: 'siwx_missing_header' };

    let payload: { wallet: string; nonce: string; expired?: boolean };
    try {
      payload = JSON.parse(Buffer.from(header, 'base64').toString());
    } catch {
      return { valid: false, wallet: null, code: 'siwx_malformed' };
    }

    if (payload.expired) return { valid: false, wallet: null, code: 'siwx_expired' };

    const nonceOk = await nonceStore.check(payload.nonce);
    if (!nonceOk) return { valid: false, wallet: null, code: 'siwx_nonce_used' };

    return { valid: true, wallet: payload.wallet };
  },
  buildSIWXExtension: () => ({}),
  SIWX_ERROR_MESSAGES: {
    siwx_missing_header: 'Missing SIGN-IN-WITH-X header',
    siwx_malformed: 'Malformed SIWX payload',
    siwx_expired: 'SIWX message expired — request a new challenge',
    siwx_nonce_used: 'Nonce already used — request a new challenge',
    siwx_invalid_signature: 'Invalid signature — wallet mismatch or corrupted proof',
  },
}));

// Mock Bazaar extensions to avoid require('@x402/extensions/bazaar')
vi.mock('zod', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Keep actual zod but add toJSONSchema stub if needed
  };
});

// Mock MPP known payer
const KNOWN_MPP_PAYER = '0xMPP_PAYER_1234567890';

// Mock Credential.fromRequest to return source as the payer DID
vi.mock('mppx', () => ({
  Credential: {
    fromRequest: (request: Request) => {
      const auth = request.headers.get('Authorization');
      if (!auth?.startsWith('Payment ')) return null;
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(8), 'base64').toString());
        return { source: payload.payer, challenge: {}, payload: payload.payload ?? {} };
      } catch {
        return null;
      }
    },
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

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const bodySchema = z.object({ query: z.string() });
const ALT_MPP_RECIPIENT = '0x9999999999999999999999999999999999999999';

function makeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.02',
    protocols: ['x402'],
    method: 'POST',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RouterDeps> = {}): RouterDeps {
  const server = new FakeX402Server();
  return {
    x402Server: server as unknown as Record<string, Function>,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'eip155:8453',
    x402Accepts: [{ network: 'eip155:8453', payTo: KNOWN_PAYEE }],
    ...overrides,
  };
}

function makeProbeRequest(url = 'http://localhost:3000/api/test'): NextRequest {
  return new NextRequest(url, { method: 'POST' });
}

function makePaymentRequest(body?: unknown, payer = KNOWN_PAYER): NextRequest {
  return withX402Payment({ payer, body });
}

function makeSIWXRequest(
  wallet = '0xSIWX_WALLET',
  nonce = 'test-nonce',
  expired = false,
): NextRequest {
  const payload = Buffer.from(JSON.stringify({ wallet, nonce, expired })).toString('base64');
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'GET',
    headers: { 'SIGN-IN-WITH-X': payload },
  });
}

// Fake mppx instance for tests
function createFakeMppx() {
  return {
    charge: (options: { amount: string }) => async (input: Request) => {
      const auth = input.headers.get('Authorization');
      if (!auth?.startsWith('Payment ')) {
        // No credential — return 402 challenge
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
              const newResponse = new Response(response.body, {
                status: response.status,
                headers: response.headers,
              });
              newResponse.headers.set('Payment-Receipt', 'MOCK_MPP_RECEIPT');
              return newResponse;
            },
          };
        }
      } catch {
        // Invalid credential
      }

      // Bad credential — return 402
      return {
        status: 402 as const,
        challenge: new Response(null, {
          status: 402,
          headers: { 'WWW-Authenticate': 'MOCK_MPP_CHALLENGE' },
        }),
      };
    },
  };
}

// MPP-specific helpers
function makeMPPDeps(overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'tempo:42431',
    x402Accepts: [],
    mppx: createFakeMppx(),
    ...overrides,
  };
}

function makeMPPEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/mpp-route',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.02',
    protocols: ['mpp'],
    method: 'POST',
    ...overrides,
  };
}

function withMPPPayment(
  options: { payer?: string; body?: unknown; payload?: Record<string, unknown> } = {},
): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({ payer: options.payer ?? KNOWN_MPP_PAYER, payload: options.payload }),
  ).toString('base64');

  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { Authorization: `Payment ${credential}` },
    ...(options.body && { body: JSON.stringify(options.body) }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('probe request (no auth header)', () => {
  it('returns 402 without reading body', async () => {
    const entry = makeEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({ data: 'hello' }), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);
  });

  it('returns 402 with PAYMENT-REQUIRED header for x402 routes', async () => {
    const entry = makeEntry();
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('does not run Zod validation on probe', async () => {
    const zodSpy = vi.fn();
    const entry = makeEntry({
      bodySchema: {
        safeParse: zodSpy,
      } as unknown as z.ZodType,
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    await handler(makeProbeRequest());
    expect(zodSpy).not.toHaveBeenCalled();
  });

  it('uses maxPrice for dynamic pricing in 402 challenge', async () => {
    const entry = makeEntry({
      pricing: (body: unknown) => '0.05',
      maxPrice: '1.00',
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);
    // The challenge should be built (no error from missing maxPrice)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('parses body early for tiered pricing so challenge uses tier price', async () => {
    const tierSchema = z.object({ tier: z.string() });
    const entry = makeEntry({
      bodySchema: tierSchema,
      pricing: {
        field: 'tier',
        tiers: {
          '10mb': { price: '0.02', label: '10 MB' },
          '1gb': { price: '2.00', label: '1 GB' },
        },
      },
    });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), makeDeps());
    // Probe with body specifying the cheap tier
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ tier: '10mb' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
    // Decode the challenge to verify the price is the tier price, not maxPrice.
    // Real x402 challenges advertise atomic units (USDC 6 decimals → 0.02 = 20000).
    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.accepts[0].amount ?? challenge.accepts[0].maxAmountRequired).toBe('20000');
  });

  it('emits a bazaar discovery extension for routes with no input schema', async () => {
    const entry = makeEntry();
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);
    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar).toBeDefined();
    expect(challenge.extensions.bazaar.info.input.type).toBe('http');
    expect(challenge.extensions.bazaar.info.input.bodyType).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// Unpaid probe tests.
// Valid body probes should still receive a 402 challenge with the quoted price.
// Invalid body probes should fail before payment so invalid requests are not
// presented as payable.
// ---------------------------------------------------------------------------

describe('discovery probe (x402scan prober)', () => {
  // x402scan sends POST with empty JSON body '{}' for discovery
  function makeX402ScanProbe(url = 'http://localhost:3000/api/test'): NextRequest {
    return new NextRequest(url, {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }

  describe('x402 routes', () => {
    it('returns 400 with dynamic pricing and empty probe body', async () => {
      const entry = makeEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull();
    });

    it('returns 400 with no body at all when dynamic pricing needs body data', async () => {
      const entry = makeEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      // No body, no Content-Type — bare probe
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when probe body fails schema validation', async () => {
      const pricingFn = vi.fn((_body: unknown) => '0.05');
      const entry = makeEntry({
        pricing: pricingFn,
        maxPrice: '10.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull();
      // Pricing function should NOT be called — body was invalid
      expect(pricingFn).not.toHaveBeenCalled();
    });

    it('returns 400 for schema-excluded enum values before payment challenge', async () => {
      const pricingFn = vi.fn((body: unknown) => {
        const tier = (body as { tier: string }).tier;
        return tier === 'short-10mb' ? '0.005' : '2.00';
      });
      const entry = makeEntry({
        pricing: pricingFn,
        maxPrice: '2.00',
        bodySchema: z.object({
          tier: z.enum(['10mb', '100mb', '1gb', 'short-10mb']),
        }),
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ tier: 'short-5gb' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handler(req);

      expect(res.status).toBe(400);
      expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull();
      expect(pricingFn).not.toHaveBeenCalled();
    });

    it('still returns accurate price when probe sends valid body', async () => {
      const pricingFn = vi.fn((_body: unknown) => '0.05');
      const entry = makeEntry({
        pricing: pricingFn,
        maxPrice: '10.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const res = await handler(req);
      expect(res.status).toBe(402);
      // Pricing function IS called with valid body
      expect(pricingFn).toHaveBeenCalled();
    });

    it('returns 400 when validateFn exists but body fails parse', async () => {
      const validateFn = vi.fn();
      const entry = makeEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
        validateFn,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      // validateFn should NOT be called — body failed parse
      expect(validateFn).not.toHaveBeenCalled();
    });

    it('returns 400 with an Invalid JSON error for malformed request bodies', async () => {
      const entry = makeEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: '{not json',
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
      expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull();
      expect((await res.json()).error).toBe('Invalid JSON');
    });
  });

  describe('MPP routes', () => {
    it('returns 400 with dynamic pricing and empty probe body', async () => {
      const entry = makeMPPEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeMPPDeps());
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      expect(res.headers.get('WWW-Authenticate')).toBeNull();
    });

    it('returns 400 with no body at all when dynamic pricing needs body data', async () => {
      const entry = makeMPPEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeMPPDeps());
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
      const res = await handler(req);
      expect(res.status).toBe(400);
    });
  });

  describe('dual-protocol routes', () => {
    it('returns 400 before x402 or MPP challenges when probe body is invalid', async () => {
      const entry = makeEntry({
        pricing: (_body: unknown) => '0.05',
        maxPrice: '5.00',
        bodySchema,
        protocols: ['x402', 'mpp'],
      });
      const deps = makeDeps({ mppx: createFakeMppx() });
      const handler = createRequestHandler(entry, async () => ({}), deps);
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull();
      expect(res.headers.get('WWW-Authenticate')).toBeNull();
    });
  });

  describe('SIWX routes', () => {
    it('returns 400 when body fails parse before SIWX validation', async () => {
      const validateFn = vi.fn();
      const entry = makeEntry({
        authMode: 'siwx',
        protocols: [],
        bodySchema,
        validateFn,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const res = await handler(makeX402ScanProbe());
      expect(res.status).toBe(400);
      // validateFn should NOT be called — body failed parse
      expect(validateFn).not.toHaveBeenCalled();
    });

    it('challenge nests SIWX fields under extensions.sign-in-with-x.info', async () => {
      const entry = makeEntry({ authMode: 'siwx', protocols: [], pricing: undefined });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      const res = await handler(
        new NextRequest('http://localhost:3000/api/test', { method: 'POST' }),
      );
      expect(res.status).toBe(402);

      const body = await res.json();
      const ext = body.extensions['sign-in-with-x'];
      expect(ext.info).toMatchObject({
        domain: expect.any(String),
        uri: expect.any(String),
        version: expect.any(String),
        chainId: expect.any(String),
        type: expect.any(String),
        nonce: expect.any(String),
        issuedAt: expect.any(String),
      });
      expect(Array.isArray(ext.supportedChains)).toBe(true);

      // The header-encoded challenge must stay identical to the JSON body.
      const header = res.headers.get('PAYMENT-REQUIRED');
      expect(header).toBeTruthy();
      expect(decodePaymentRequiredHeader(header!).extensions).toEqual(body.extensions);
    });
  });

  describe('payment present with invalid body still returns 400', () => {
    it('x402: returns 400 when payment header present but body invalid', async () => {
      const entry = makeEntry({
        pricing: '0.05',
        bodySchema,
      });
      const handler = createRequestHandler(entry, async () => ({}), makeDeps());
      // Payment header present, but body is invalid
      const payload = Buffer.from(JSON.stringify({ payer: KNOWN_PAYER, amount: '0.05' })).toString(
        'base64',
      );
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'PAYMENT-SIGNATURE': payload, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    it('MPP: returns 400 when credential present but body invalid', async () => {
      const entry = makeMPPEntry({ bodySchema });
      const handler = createRequestHandler(entry, async () => ({}), makeMPPDeps());
      const credential = Buffer.from(JSON.stringify({ payer: KNOWN_MPP_PAYER })).toString('base64');
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { Authorization: `Payment ${credential}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
    });
  });
});

describe('query schema validation', () => {
  const querySchema = z.object({ limit: z.coerce.number().int().positive() });

  it('unprotected: valid query reaches the handler with parsed data', async () => {
    const entry = makeEntry({
      authMode: 'unprotected',
      pricing: undefined,
      querySchema,
      method: 'GET',
    });
    let seen: unknown;
    const handler = createRequestHandler(
      entry,
      async ({ query }) => {
        seen = query;
        return { ok: true };
      },
      makeDeps(),
    );
    const res = await handler(new NextRequest('http://localhost:3000/api/test?limit=5'));
    expect(res.status).toBe(200);
    expect(seen).toEqual({ limit: 5 });
  });

  it('unprotected: invalid query returns a structured 400 before the handler runs', async () => {
    const entry = makeEntry({
      authMode: 'unprotected',
      pricing: undefined,
      querySchema,
      method: 'GET',
    });
    let handlerRan = false;
    const handler = createRequestHandler(
      entry,
      async () => {
        handlerRan = true;
        return {};
      },
      makeDeps(),
    );
    const res = await handler(new NextRequest('http://localhost:3000/api/test?limit=abc'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(handlerRan).toBe(false);
  });

  it('paid: missing query on unpaid probe returns 402 challenge (not 400)', async () => {
    const entry = makeEntry({ querySchema, method: 'GET' });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(new NextRequest('http://localhost:3000/api/test'));
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('paid: invalid query on unpaid probe returns 402 challenge (not 400)', async () => {
    const entry = makeEntry({ querySchema, method: 'GET' });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(new NextRequest('http://localhost:3000/api/test?limit=abc'));
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('paid: invalid query with payment header returns 400', async () => {
    const entry = makeEntry({ querySchema, method: 'GET' });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const payload = Buffer.from(JSON.stringify({ payer: KNOWN_PAYER, amount: '0.02' })).toString('base64');
    const res = await handler(new NextRequest('http://localhost:3000/api/test?limit=abc', {
      method: 'GET',
      headers: { 'PAYMENT-SIGNATURE': payload },
    }));
    expect(res.status).toBe(400);
  });

  it('paid: valid query still issues a 402 challenge on a probe request', async () => {
    const entry = makeEntry({ querySchema, method: 'GET' });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(new NextRequest('http://localhost:3000/api/test?limit=5'));
    expect(res.status).toBe(402);
  });
});

describe('x402 paid route', () => {
  it('returns 200 with settlement header on valid payment', async () => {
    const entry = makeEntry({ bodySchema });
    const deps = makeDeps();
    const handler = createRequestHandler(
      entry,
      async ({ body }) => ({ result: (body as { query: string }).query }),
      deps,
    );
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe('test');
  });

  it('returns 402 on invalid payment (bad payer)', async () => {
    const entry = makeEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makePaymentRequest({ query: 'test' }, 'BAD_PAYER'));
    expect(res.status).toBe(402);
  });

  it('skips settlement when handler returns error status', async () => {
    const entry = makeEntry({ bodySchema });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    const handler = createRequestHandler(
      entry,
      async () => {
        const { NextResponse } = await import('next/server');
        return NextResponse.json({ error: 'bad request' }, { status: 400 });
      },
      deps,
    );
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeNull();
    expect(server.settledPayments).toHaveLength(0);
  });

  it('fails the request when x402 settlement returns success=false', async () => {
    let capturedSettlementError: SettlementErrorContext | null = null;
    const entry = makeEntry({
      bodySchema,
      settlement: {
        onSettlementError: async (ctx) => {
          capturedSettlementError = ctx;
        },
      },
    });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    server.settlePayment = async (payload: unknown, requirements: unknown) => {
      server.settledPayments.push({ payload, requirements });
      return {
        success: false,
        errorReason: 'Transaction simulation failed',
        transaction: '',
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      };
    };
    const handler = createRequestHandler(
      entry,
      async ({ body }) => ({ result: (body as { query: string }).query }),
      deps,
    );

    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(500);
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeNull();
    expect(server.settledPayments).toHaveLength(1);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Settlement failed');
    expect(capturedSettlementError?.phase).toBe('settle');
    expect(capturedSettlementError?.payment.status).toBe('verified');
    expect(capturedSettlementError?.error).toBeInstanceOf(Error);
  });

  it('skips settlement when handler throws', async () => {
    const entry = makeEntry({ bodySchema });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('Handler boom');
      },
      deps,
    );
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(500);
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeNull();
    expect(server.settledPayments).toHaveLength(0);
  });

  it('sets wallet on handler context from verified payer', async () => {
    const entry = makeEntry({ bodySchema });
    let capturedWallet: string | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedWallet = ctx.wallet;
        return { ok: true };
      },
      makeDeps(),
    );
    await handler(makePaymentRequest({ query: 'test' }));
    // EVM ctx.wallet values are canonicalized to lowercase.
    expect(capturedWallet).toBe(KNOWN_PAYER.toLowerCase());
  });

  it('sets verified x402 payment metadata on handler context', async () => {
    const entry = makeEntry({ bodySchema });
    let capturedPayment: HandlerPaymentContext | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedPayment = ctx.payment;
        return { ok: true };
      },
      makeDeps(),
    );

    await handler(makePaymentRequest({ query: 'test' }));

    expect(capturedPayment).toEqual({
      protocol: 'x402',
      status: 'verified',
      payer: KNOWN_PAYER.toLowerCase(),
      amount: '0.02',
      network: 'eip155:8453',
      recipient: KNOWN_PAYEE,
    });
  });

  it('uses capped maxPrice when verifying paid dynamic-price requests', async () => {
    const entry = makeEntry({
      bodySchema,
      pricing: () => '15.00',
      maxPrice: '10.00',
    });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    let capturedPayment: HandlerPaymentContext | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedPayment = ctx.payment;
        return { ok: true };
      },
      deps,
    );

    const res = await handler(makePaymentRequest({ query: 'test' }));

    expect(res.status).toBe(200);
    // capturedPayment.amount is the orchestrator's decimal-form quoted price;
    // requirements.amount is the on-the-wire atomic form (USDC 6 decimals).
    expect(capturedPayment?.amount).toBe('10.00');
    expect(
      (server.settledPayments[0].requirements as { amount?: string; maxAmountRequired?: string })
        .amount,
    ).toBe('10000000');
  });

  it('runs beforeSettle and skips x402 settlement when it rejects', async () => {
    let captured: SettlementLifecycleContext | null = null;
    const entry = makeEntry({
      bodySchema,
      settlement: {
        beforeSettle: async (ctx) => {
          captured = ctx;
          throw Object.assign(new Error('Result failed final validation'), { status: 409 });
        },
      },
    });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    const handler = createRequestHandler(entry, async () => ({ result: 'ok' }), deps);

    const res = await handler(makePaymentRequest({ query: 'test' }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Result failed final validation',
    });
    expect(server.settledPayments).toHaveLength(0);
    expect(captured?.body).toEqual({ query: 'test' });
    expect(captured?.result).toEqual({ result: 'ok' });
    expect(captured?.payment.status).toBe('verified');
    expect(captured?.response.status).toBe(200);
  });

  it('runs afterSettle with settled x402 metadata', async () => {
    let captured: SettlementSettledContext | null = null;
    const entry = makeEntry({
      bodySchema,
      settlement: {
        afterSettle: async (ctx) => {
          captured = ctx;
        },
      },
    });
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    const handler = createRequestHandler(entry, async () => ({ result: 'ok' }), deps);

    const res = await handler(makePaymentRequest({ query: 'test' }));

    expect(res.status).toBe(200);
    expect(server.settledPayments).toHaveLength(1);
    expect(captured?.payment).toMatchObject({
      protocol: 'x402',
      status: 'settled',
      payer: KNOWN_PAYER.toLowerCase(),
      amount: '0.02',
      network: 'eip155:8453',
      recipient: KNOWN_PAYEE,
    });
    expect(captured?.payment.transaction).toMatch(/^0xTX_HASH_FAKE/);
    expect(captured?.response.headers.get('PAYMENT-RESPONSE')).toBeTruthy();
  });

  it('returns 400 on Zod validation failure', async () => {
    const entry = makeEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    // Body with wrong type for 'query'
    const res = await handler(makePaymentRequest({ query: 123 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('MPP paid route', () => {
  it('returns 402 with WWW-Authenticate header on probe', async () => {
    const entry = makeMPPEntry();
    const handler = createRequestHandler(entry, async () => ({}), makeMPPDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);
    expect(res.headers.get('WWW-Authenticate')).toBeTruthy();
  });

  it('returns 200 with Payment-Receipt header on valid credential', async () => {
    const entry = makeMPPEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ body }) => ({ result: (body as { query: string }).query }),
      makeMPPDeps(),
    );
    const res = await handler(withMPPPayment({ body: { query: 'test' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Payment-Receipt')).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe('test');
  });

  it('returns 402 on invalid credential (bad payer)', async () => {
    const entry = makeMPPEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({}), makeMPPDeps());
    const res = await handler(withMPPPayment({ payer: 'BAD_PAYER', body: { query: 'test' } }));
    expect(res.status).toBe(402);
  });

  it('skips receipt when handler throws', async () => {
    const entry = makeMPPEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('Handler boom');
      },
      makeMPPDeps(),
    );
    const res = await handler(withMPPPayment({ body: { query: 'test' } }));
    expect(res.status).toBe(500);
    expect(res.headers.get('Payment-Receipt')).toBeNull();
  });

  it('runs onSettledHandlerError when an already-settled MPP request fails in the handler', async () => {
    let captured: SettledHandlerErrorContext | null = null;
    const entry = makeMPPEntry({
      bodySchema,
      settlement: {
        onSettledHandlerError: async (ctx) => {
          captured = ctx;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async () => {
        throw Object.assign(new Error('Handler boom'), { status: 503 });
      },
      makeMPPDeps(),
    );

    const res = await handler(withMPPPayment({ body: { query: 'test' } }));

    expect(res.status).toBe(503);
    expect(res.headers.get('Payment-Receipt')).toBeNull();
    expect(captured?.payment).toMatchObject({
      protocol: 'mpp',
      status: 'settled',
      payer: KNOWN_MPP_PAYER.toLowerCase(),
      amount: '0.02',
      receipt: 'MOCK_MPP_RECEIPT',
    });
    expect(captured?.response.status).toBe(503);
    expect((captured?.error as { status?: number }).status).toBe(503);
    expect((captured?.error as Error).message).toBe('Handler boom');
  });

  it('sets wallet on handler context from verified payer', async () => {
    const entry = makeMPPEntry({ bodySchema });
    let capturedWallet: string | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedWallet = ctx.wallet;
        return { ok: true };
      },
      makeMPPDeps(),
    );
    await handler(withMPPPayment({ body: { query: 'test' } }));
    // EVM ctx.wallet values are canonicalized to lowercase.
    expect(capturedWallet).toBe(KNOWN_MPP_PAYER.toLowerCase());
  });

  it('sets settled MPP payment metadata on handler context', async () => {
    const entry = makeMPPEntry({ bodySchema });
    let capturedPayment: HandlerPaymentContext | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedPayment = ctx.payment;
        return { ok: true };
      },
      makeMPPDeps(),
    );

    await handler(withMPPPayment({ body: { query: 'test' } }));

    expect(capturedPayment).toEqual({
      protocol: 'mpp',
      status: 'settled',
      payer: KNOWN_MPP_PAYER.toLowerCase(),
      amount: '0.02',
      network: 'tempo:4217',
      recipient: KNOWN_PAYEE,
      receipt: 'MOCK_MPP_RECEIPT',
    });
  });

  it('uses the configured MPP recipient when router payeeAddress is absent', async () => {
    const entry = makeMPPEntry({ bodySchema });
    const deps = makeMPPDeps({ payeeAddress: '', mppRecipient: ALT_MPP_RECIPIENT });
    let capturedPayment: HandlerPaymentContext | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedPayment = ctx.payment;
        return { ok: true };
      },
      deps,
    );

    await handler(withMPPPayment({ body: { query: 'test' } }));

    expect(capturedPayment?.recipient).toBe(ALT_MPP_RECIPIENT);
  });

  it('passes the original MPP rejection result to settlement error hooks', async () => {
    let captured: SettlementErrorContext | null = null;
    const challenge = new Response(JSON.stringify({ detail: 'tempo reverted' }), {
      status: 402,
    });
    const rejected = { status: 402 as const, challenge };
    const mppx = {
      charge: () => async () => rejected,
    };
    const entry = makeMPPEntry({
      bodySchema,
      settlement: {
        onSettlementError: async (ctx) => {
          captured = ctx;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async () => ({ ok: true }),
      makeMPPDeps({
        mppx,
        tempoClient: {} as never,
      }),
    );

    const res = await handler(
      withMPPPayment({
        body: { query: 'test' },
        payload: { type: 'transaction', signature: '0xdeadbeef' },
      }),
    );

    expect(res.status).toBe(500);
    expect(captured?.phase).toBe('settle');
    expect((captured?.error as { mppResult?: unknown }).mppResult).toBe(rejected);
    expect((captured?.error as { challenge?: Response }).challenge).toBe(challenge);
  });

  it('runs onSettlementError when MPP transaction broadcast throws', async () => {
    let captured: SettlementErrorContext | null = null;
    const broadcastError = new Error('tempo rpc down');
    const mppx = {
      charge: () => async () => {
        throw broadcastError;
      },
    };
    const entry = makeMPPEntry({
      bodySchema,
      settlement: {
        onSettlementError: async (ctx) => {
          captured = ctx;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async () => ({ ok: true }),
      makeMPPDeps({
        mppx,
        tempoClient: {} as never,
      }),
    );

    const res = await handler(
      withMPPPayment({
        body: { query: 'test' },
        payload: { type: 'transaction', signature: '0xdeadbeef' },
      }),
    );

    expect(res.status).toBe(500);
    expect(captured?.phase).toBe('settle');
    expect(captured?.error).toBe(broadcastError);
    expect(captured?.payment.status).toBe('verified');
  });
});

describe('SIWX route', () => {
  it('returns 402 challenge when no SIWX header', async () => {
    const entry = makeEntry({ authMode: 'siwx', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(402);
  });

  it('returns 200 with wallet from verified signature', async () => {
    const entry = makeEntry({ authMode: 'siwx', protocols: [] });
    let capturedWallet: string | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedWallet = ctx.wallet;
        return { status: 'ok' };
      },
      makeDeps(),
    );
    const res = await handler(makeSIWXRequest('0xMyWallet', 'nonce-1'));
    expect(res.status).toBe(200);
    // EVM ctx.wallet values are canonicalized to lowercase.
    expect(capturedWallet).toBe('0xmywallet');
  });

  it('rejects replayed nonce', async () => {
    const deps = makeDeps();
    const entry = makeEntry({ authMode: 'siwx', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);

    // First request succeeds
    const res1 = await handler(makeSIWXRequest('0xWallet', 'same-nonce'));
    expect(res1.status).toBe(200);

    // Replay with same nonce fails
    const res2 = await handler(makeSIWXRequest('0xWallet', 'same-nonce'));
    expect(res2.status).toBe(402);
  });

  it('rejects expired SIWX message', async () => {
    const entry = makeEntry({ authMode: 'siwx', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeSIWXRequest('0xWallet', 'nonce-1', true));
    expect(res.status).toBe(402);
  });
});

describe('paid + SIWX acceleration', () => {
  it('grants access with SIWX when entitlement already exists', async () => {
    const deps = makeDeps();
    await deps.entitlementStore.grant('test/route', '0xwallet');
    const entry = makeEntry({ authMode: 'paid', siwxEnabled: true });
    let capturedWallet: string | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedWallet = ctx.wallet;
        return { ok: true };
      },
      deps,
    );

    const res = await handler(makeSIWXRequest('0xWallet', 'entitled-nonce'));
    expect(res.status).toBe(200);
    expect(capturedWallet).toBe('0xwallet');
  });

  it('falls back to payment challenge when SIWX is valid but entitlement is missing', async () => {
    const entry = makeEntry({ authMode: 'paid', siwxEnabled: true });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), makeDeps());

    const res = await handler(makeSIWXRequest('0xWallet', 'not-entitled-nonce'));
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('records entitlement after successful payment settlement', async () => {
    const deps = makeDeps();
    const entry = makeEntry({ authMode: 'paid', siwxEnabled: true });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);

    const paid = await handler(makePaymentRequest());
    expect(paid.status).toBe(200);
    expect(await deps.entitlementStore.has('test/route', KNOWN_PAYER)).toBe(true);

    const accelerated = await handler(makeSIWXRequest(KNOWN_PAYER, 'post-payment-nonce'));
    expect(accelerated.status).toBe(200);
  });
});

describe('unprotected route', () => {
  it('returns 200 with no auth required', async () => {
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({ status: 'ok' }), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('wallet is null on handler context', async () => {
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    let capturedWallet: string | null | undefined;
    let capturedPayment: HandlerPaymentContext | null | undefined;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedWallet = ctx.wallet;
        capturedPayment = ctx.payment;
        return {};
      },
      makeDeps(),
    );
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'GET' });
    await handler(req);
    expect(capturedWallet).toBeNull();
    expect(capturedPayment).toBeNull();
  });
});

describe('API key + paid route', () => {
  const apiKeyResolver = (key: string) => (key === 'valid-key' ? { id: 'account-1' } : null);

  it('rejects missing API key before checking payment', async () => {
    const entry = makeEntry({
      authMode: 'apiKey',
      apiKeyResolver,
      pricing: '0.01',
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid API key', async () => {
    const entry = makeEntry({
      authMode: 'apiKey',
      apiKeyResolver,
      pricing: '0.01',
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-API-Key': 'bad-key' },
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('accepts falsy-but-non-null account from resolver', async () => {
    const falsyResolver = (key: string) => (key === 'valid-key' ? 0 : null); // returns 0 (falsy but valid)
    const entry = makeEntry({
      authMode: 'apiKey',
      apiKeyResolver: falsyResolver,
      pricing: undefined, // apiKey-only, no payment required
      protocols: [],
    });
    let capturedAccount: unknown;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedAccount = ctx.account;
        return { ok: true };
      },
      makeDeps(),
    );
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-API-Key': 'valid-key' },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(capturedAccount).toBe(0);
  });

  it('processes payment after valid API key', async () => {
    const entry = makeEntry({
      authMode: 'apiKey',
      apiKeyResolver,
      pricing: '0.01',
      bodySchema,
    });
    const deps = makeDeps();
    let capturedAccount: unknown;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        capturedAccount = ctx.account;
        return { ok: true };
      },
      deps,
    );

    // Valid key + valid payment
    const payload = Buffer.from(JSON.stringify({ payer: KNOWN_PAYER, amount: '0.01' })).toString(
      'base64',
    );
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'X-API-Key': 'valid-key',
        'PAYMENT-SIGNATURE': payload,
      },
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(capturedAccount).toEqual({ id: 'account-1' });
  });
});

describe('validate()', () => {
  it('rejects with custom status before 402 challenge when validate throws', async () => {
    const entry = makeEntry({
      bodySchema,
      validateFn: () => {
        throw Object.assign(new Error('Resource taken'), { status: 409 });
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    // Probe request (no payment)
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Resource taken');
  });

  it('defaults to 400 when validate throws error without status', async () => {
    const entry = makeEntry({
      bodySchema,
      validateFn: () => {
        throw new Error('Invalid input');
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 402 challenge when validate passes (no payment)', async () => {
    let validateCalled = false;
    const entry = makeEntry({
      bodySchema,
      validateFn: () => {
        validateCalled = true;
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(validateCalled).toBe(true);
    expect(res.status).toBe(402);
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('runs handler when validate passes + payment valid', async () => {
    let handlerCalled = false;
    const entry = makeEntry({
      bodySchema,
      validateFn: () => {
        // passes
      },
    });
    const handler = createRequestHandler(
      entry,
      async () => {
        handlerCalled = true;
        return { ok: true };
      },
      makeDeps(),
    );
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(200);
    expect(handlerCalled).toBe(true);
  });

  it('rejects with error when payment present but validate fails (no settlement)', async () => {
    const deps = makeDeps();
    const server = deps.x402Server as unknown as FakeX402Server;
    let handlerCalled = false;
    const entry = makeEntry({
      bodySchema,
      validateFn: () => {
        throw Object.assign(new Error('Resource unavailable'), { status: 410 });
      },
    });
    const handler = createRequestHandler(
      entry,
      async () => {
        handlerCalled = true;
        return { ok: true };
      },
      deps,
    );
    // Payment header present but validate should reject before verification
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(410);
    expect(handlerCalled).toBe(false);
    expect(server.settledPayments).toHaveLength(0);
  });

  it('supports async validate function', async () => {
    const entry = makeEntry({
      bodySchema,
      validateFn: async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw Object.assign(new Error('Async rejection'), { status: 429 });
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(429);
  });

  it('works with SIWX auth mode', async () => {
    const entry = makeEntry({
      authMode: 'siwx',
      protocols: [],
      bodySchema,
      validateFn: () => {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    // No SIWX header - should validate before challenge
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(403);
  });

  it('works with apiKey auth mode (no pricing)', async () => {
    const entry = makeEntry({
      authMode: 'apiKey',
      apiKeyResolver: (key) => (key === 'valid' ? { id: '1' } : null),
      protocols: [],
      pricing: undefined,
      bodySchema,
      validateFn: () => {
        throw Object.assign(new Error('Rate limited'), { status: 429 });
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-API-Key': 'valid' },
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(429);
  });

  it('works with unprotected auth mode', async () => {
    const entry = makeEntry({
      authMode: 'unprotected',
      protocols: [],
      pricing: undefined,
      bodySchema,
      validateFn: () => {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});

describe('x402 challenge build failure (facilitator 429 / empty supported kinds)', () => {
  it('returns 500 when challenge build throws — not a bare 402', async () => {
    // Simulate what happens when getSupported() failed silently during init:
    // the server has empty supported-kinds maps, so buildPaymentRequirementsFromOptions
    // throws "Facilitator does not support scheme X on network Y".
    const brokenServer = new FakeX402Server();
    brokenServer.buildPaymentRequirementsFromOptions = () => {
      throw new Error(
        'Facilitator does not support scheme "exact" on network "eip155:8453". ' +
          'Make sure to call initialize() to fetch supported kinds from facilitators.',
      );
    };

    const entry = makeEntry();
    const deps = makeDeps({ x402Server: brokenServer as unknown as RouterDeps['x402Server'] });
    const handler = createRequestHandler(entry, async () => ({}), deps);
    const res = await handler(makeProbeRequest());

    // Must NOT be a bare 402 — that's the bug. Clients get a 402 with no
    // PAYMENT-REQUIRED header and can't pay. Should be 500 so operators
    // see the init failure instead of silent payment breakage.
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/challenge|facilitator/i);
  });

  it('returns 500 when x402InitError is set (retryInit threw)', async () => {
    const entry = makeEntry();
    const deps = makeDeps({
      x402Server: null,
      x402InitError: 'Facilitator getSupported failed (429): Too Many Requests',
    });
    const handler = createRequestHandler(entry, async () => ({}), deps);
    const res = await handler(makeProbeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/429|initialization failed/i);
  });
});

// ---------------------------------------------------------------------------
// Bazaar schema in 402 challenges
// ---------------------------------------------------------------------------

describe('Bazaar schema generation', () => {
  it('includes inputSchema in 402 challenge for plain body schemas', async () => {
    const entry = makeEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar?.schema?.properties?.input?.properties?.body).toBeDefined();
    // The body schema should contain the 'query' field from bodySchema
    const bodyProps = challenge.extensions.bazaar.schema.properties.input.properties.body;
    expect(bodyProps.properties?.query).toBeDefined();
  });

  it('handles .transform() schemas without throwing', async () => {
    const transformSchema = z.object({
      amount: z.number(),
      address: z.string().transform((s) => s.toLowerCase()),
    });
    const entry = makeEntry({ bodySchema: transformSchema });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    // Bazaar extension should still be present
    expect(challenge.extensions?.bazaar).toBeDefined();
    // The body schema should have both fields — 'address' as {} (unrepresentable)
    const bodyProps = challenge.extensions.bazaar.schema.properties.input.properties.body;
    expect(bodyProps.properties?.amount).toBeDefined();
    expect(bodyProps.properties?.address).toBeDefined();
  });

  it('handles .refine() schemas without throwing', async () => {
    const refineSchema = z.object({
      value: z.string().refine((s) => s.length > 0, 'Must not be empty'),
    });
    const entry = makeEntry({ bodySchema: refineSchema });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar).toBeDefined();
    const bodyProps = challenge.extensions.bazaar.schema.properties.input.properties.body;
    expect(bodyProps.properties?.value).toBeDefined();
  });

  it('embeds routeEntry.method on the bazaar input declaration', async () => {
    // Regression: previously `input.method` was omitted, which failed the bazaar
    // discovery validator (QueryInput schema requires method ∈ {GET,HEAD,DELETE};
    // BodyInput requires method ∈ {POST,PUT,PATCH}).
    const entry = makeEntry({ bodySchema, method: 'POST' });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar?.info?.input?.method).toBe('POST');
  });

  it('omits output block when no outputExample is registered', async () => {
    // Regression: previously emitted `output.example: {}`, which failed validation
    // when the outputSchema declared required fields. Without an example, the
    // whole output block must be dropped from the declaration.
    const outputSchemaWithRequired = z.object({ result: z.string() });
    const entry = makeEntry({ bodySchema, outputSchema: outputSchemaWithRequired });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar?.info?.output).toBeUndefined();
    expect(challenge.extensions?.bazaar?.schema?.properties?.output).toBeUndefined();
  });

  it('emits output block with example when outputExample is registered', async () => {
    const outputSchemaWithRequired = z.object({ result: z.string() });
    const entry = makeEntry({
      bodySchema,
      outputSchema: outputSchemaWithRequired,
      outputExample: { result: 'ok' },
    });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar?.info?.output?.example).toEqual({ result: 'ok' });
  });

  it('populates input.body from inputExample for body routes', async () => {
    const entry = makeEntry({ bodySchema, inputExample: { query: 'example-term' } });
    const handler = createRequestHandler(entry, async () => ({}), makeDeps());
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    const encoded = res.headers.get('PAYMENT-REQUIRED')!;
    const challenge = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(challenge.extensions?.bazaar?.info?.input?.body).toEqual({ query: 'example-term' });
  });

  it('fires onAlert warn when Bazaar generation fails entirely', async () => {
    const alerts: Array<{ level: string; message: string }> = [];
    const entry = makeEntry({
      // Pass a non-schema value that will cause toJSONSchema to throw
      bodySchema: 'not-a-schema' as unknown as typeof bodySchema,
    });
    const deps = makeDeps({
      plugin: {
        onAlert: (_ctx: unknown, alert: { level: string; message: string }) => {
          alerts.push(alert);
        },
      },
    });
    const handler = createRequestHandler(entry, async () => ({}), deps);
    const res = await handler(makeProbeRequest());
    expect(res.status).toBe(402);

    // Should have fired a warn alert about Bazaar failure
    const bazaarAlert = alerts.find((a) => a.level === 'warn' && a.message.includes('Bazaar'));
    expect(bazaarAlert).toBeDefined();
  });
});
