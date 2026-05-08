import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { RouteRegistry } from '../src/registry.js';
import { RouteBuilder } from '../src/builder.js';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import type { HandlerPaymentContext, RouteEntry, SettlementSettledContext } from '../src/types.js';
import type { RouterPlugin, SettlementEvent } from '../src/plugin.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const KNOWN_PAYER = '0xMPP_SESSION_PAYER_1234567890';
const KNOWN_PAYEE = '0xPAYEE_1234567890';

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

// ---------------------------------------------------------------------------
// Fake mppx session middleware
// ---------------------------------------------------------------------------

type ChannelChargeBehavior = (callIndex: number) => Promise<void>;

interface SessionMppxState {
  /** Indices of every channel.charge() the fake observed during a request. */
  chargeCalls: number[];
  /** Last `suggestedDeposit` mppx.session() was invoked with. */
  lastSuggestedDeposit: string | null;
  /** Last `amount` (= per-tick cost) mppx.session() was invoked with. */
  lastAmount: string | null;
  /** Last `unitType` mppx.session() was invoked with. */
  lastUnitType: string | undefined | null;
}

function createFakeSessionMppx(
  options: {
    rejectAll?: boolean;
    /** Reject session() invocations starting at this 0-indexed call number. */
    rejectAfter?: number;
    throwOnSession?: Error;
    channelChargeBehavior?: ChannelChargeBehavior;
  } = {},
) {
  const state: SessionMppxState = {
    chargeCalls: [],
    lastSuggestedDeposit: null,
    lastAmount: null,
    lastUnitType: null,
  };
  let sessionCallCount = 0;

  const session =
    (sessionOptions: { amount: string; unitType?: string; suggestedDeposit?: string }) =>
    async (request: Request) => {
      if (options.throwOnSession) throw options.throwOnSession;
      state.lastAmount = sessionOptions.amount;
      state.lastUnitType = sessionOptions.unitType;
      state.lastSuggestedDeposit = sessionOptions.suggestedDeposit ?? null;

      const callIndex = sessionCallCount++;
      const auth = request.headers.get('Authorization');
      const hasCredential = !!auth?.startsWith('Payment ');
      const exhausted = options.rejectAfter !== undefined && callIndex >= options.rejectAfter;
      if (!hasCredential || options.rejectAll || exhausted) {
        return {
          status: 402 as const,
          challenge: new Response(null, {
            status: 402,
            headers: {
              'WWW-Authenticate': `Payment realm="test", method="tempo", intent="session", suggestedDeposit="${sessionOptions.suggestedDeposit ?? ''}"`,
            },
          }),
        };
      }

      return {
        status: 200 as const,
        withReceipt: (input: unknown) =>
          buildSessionResponse(input, state, options.channelChargeBehavior),
      };
    };

  // mppx.charge is required by the deps shape (used for non-session credentials).
  const charge = () => async () => ({
    status: 402 as const,
    challenge: new Response(null, { status: 402 }),
  });

  return {
    state,
    mppx: { charge, session } as unknown as NonNullable<OrchestrateDeps['mppx']>,
  };
}

function buildSessionResponse(
  input: unknown,
  state: SessionMppxState,
  chargeBehavior?: ChannelChargeBehavior,
): Response {
  if (typeof input === 'function') {
    const controller = {
      async charge() {
        const idx = state.chargeCalls.length;
        state.chargeCalls.push(idx);
        if (chargeBehavior) await chargeBehavior(idx);
      },
    };
    const gen = (input as (c: { charge(): Promise<void> }) => AsyncIterable<unknown>)(controller);
    return responseFromIterable(gen);
  }
  if (input != null && typeof input === 'object' && Symbol.asyncIterator in (input as object)) {
    return responseFromIterable(input as AsyncIterable<unknown>);
  }
  const r = input as Response;
  const wrapped = new Response(r.body, { status: r.status, headers: r.headers });
  wrapped.headers.set('Payment-Receipt', 'MOCK_SESSION_RECEIPT');
  return wrapped;
}

function responseFromIterable(gen: AsyncIterable<unknown>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of gen) {
          const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          controller.enqueue(new TextEncoder().encode(text));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  const r = new Response(stream, { status: 200 });
  r.headers.set('Payment-Receipt', 'MOCK_SESSION_RECEIPT');
  return r;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionDeps(
  fake: ReturnType<typeof createFakeSessionMppx>,
  overrides: Partial<OrchestrateDeps> = {},
): OrchestrateDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'tempo:42431',
    x402Accepts: [{ scheme: 'upto', network: 'eip155:8453', payTo: KNOWN_PAYEE }],
    mppx: fake.mppx,
    mppSessionConfig: {},
    ...overrides,
  };
}

function makeDynamicSessionEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/session-route',
    authMode: 'paid',
    pricing: '0.05',
    protocols: ['mpp'],
    method: 'POST',
    dynamicPrice: true,
    maxPrice: '0.05',
    tickCost: '0.0001',
    unitType: 'token',
    ...overrides,
  };
}

function makeStaticMppEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/static-mpp',
    authMode: 'paid',
    pricing: '0.02',
    protocols: ['mpp'],
    method: 'POST',
    ...overrides,
  };
}

function withSessionCredential(options: {
  action?: 'open' | 'voucher' | 'topUp' | 'close';
  payer?: string;
  body?: unknown;
}): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({
      payer: options.payer ?? KNOWN_PAYER,
      payload: options.action ? { action: options.action } : {},
    }),
  ).toString('base64');

  const headers: Record<string, string> = { Authorization: `Payment ${credential}` };
  const init: RequestInit = { method: 'POST', headers };
  if (options.body !== undefined) {
    const serialized = JSON.stringify(options.body);
    init.body = serialized;
    headers['Content-Type'] = 'application/json';
    // NextRequest doesn't auto-set Content-Length — set it explicitly so
    // session-mode's hasRequestBody() correctly classifies the credential.
    headers['Content-Length'] = String(Buffer.byteLength(serialized));
  }
  return new NextRequest('http://localhost:3000/api/test', init);
}

function withChargeCredential(payer = KNOWN_PAYER, body?: unknown): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({ payer, payload: { type: 'hash', signature: '0xdead' } }),
  ).toString('base64');
  const init: RequestInit = {
    method: 'POST',
    headers: { Authorization: `Payment ${credential}` },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/test', init);
}

const bodySchema = z.object({ prompt: z.string() });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MPP session — challenge', () => {
  it('returns 402 with WWW-Authenticate session challenge on probe', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, async () => ({}), makeSessionDeps(fake));
    const res = await handler(
      new NextRequest('http://localhost:3000/api/test', { method: 'POST' }),
    );
    expect(res.status).toBe(402);
    expect(res.headers.get('WWW-Authenticate')).toMatch(/intent="session"/);
  });

  it('advertises route maxPrice as suggestedDeposit', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ maxPrice: '0.10' });
    const handler = createRequestHandler(entry, async () => ({}), makeSessionDeps(fake));
    await handler(new NextRequest('http://localhost:3000/api/test', { method: 'POST' }));
    expect(fake.state.lastSuggestedDeposit).toBe('0.10');
  });

  it('passes route tickCost and unitType to mppx.session', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ tickCost: '0.0005', unitType: 'frame' });
    const handler = createRequestHandler(entry, async () => ({}), makeSessionDeps(fake));
    await handler(new NextRequest('http://localhost:3000/api/test', { method: 'POST' }));
    expect(fake.state.lastAmount).toBe('0.0005');
    expect(fake.state.lastUnitType).toBe('frame');
  });
});

describe('MPP session — credential routing', () => {
  it('rejects charge credentials on dynamic-priced routes', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, async () => ({}), makeSessionDeps(fake));
    const res = await handler(withChargeCredential());
    expect(res.status).toBe(402);
  });

  it('rejects session credentials on static-priced routes', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeStaticMppEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(402);
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('returns 402 to client when mppx asks for channel advance (rejectAll)', async () => {
    const fake = createFakeSessionMppx({ rejectAll: true });
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(402);
  });

  it('returns 500 when mppx.session throws (config error)', async () => {
    const fake = createFakeSessionMppx({ throwOnSession: new Error('boom') });
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(500);
  });

  it('returns 500 when session config is missing on the deployment', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    // Drop the session middleware reference so the verify path hits the
    // "MPP sessions not configured" guard at runtime.
    const deps = makeSessionDeps(fake);
    deps.mppx = { charge: fake.mppx.charge } as NonNullable<OrchestrateDeps['mppx']>;
    deps.mppSessionConfig = null;
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(500);
  });
});

describe('MPP session — channel-only credentials (no metering)', () => {
  // Channel-management credentials (close/topUp/bodyless open|voucher) trigger
  // the strategy's preflight and bypass body parse + handler invocation.
  // Settle's withReceipt() emits the channel-state ack directly.

  it('close: emits ack with no metering and no handler invocation', async () => {
    const fake = createFakeSessionMppx();
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, handlerSpy, makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'close' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Payment-Receipt')).toBe('MOCK_SESSION_RECEIPT');
    expect(fake.state.chargeCalls).toEqual([]);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('topUp: emits ack with no metering and no handler invocation', async () => {
    const fake = createFakeSessionMppx();
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, handlerSpy, makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'topUp' }));
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toEqual([]);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('open with no body: skips body, validate, and handler', async () => {
    const fake = createFakeSessionMppx();
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, handlerSpy, makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'open' }));
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toEqual([]);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('voucher with no body: skips body, validate, and handler', async () => {
    const fake = createFakeSessionMppx();
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const entry = makeDynamicSessionEntry();
    const handler = createRequestHandler(entry, handlerSpy, makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'voucher' }));
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toEqual([]);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('routes with bodySchema can still serve channel-only credentials', async () => {
    // Without preflight, this would 400 at body validation since `close` has
    // no body. Preflight skips body parse so the credential reaches settle.
    const fake = createFakeSessionMppx();
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(entry, handlerSpy, makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'close' }));
    expect(res.status).toBe(200);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('routes with validate() can still serve channel-only credentials', async () => {
    const fake = createFakeSessionMppx();
    const validateSpy = vi.fn(async () => {
      throw Object.assign(new Error('should not run'), { status: 422 });
    });
    const entry = makeDynamicSessionEntry({
      bodySchema,
      validateFn: validateSpy as (body: unknown) => void | Promise<void>,
    });
    const handler = createRequestHandler(entry, async () => ({}), makeSessionDeps(fake));
    const res = await handler(withSessionCredential({ action: 'topUp' }));
    expect(res.status).toBe(200);
    expect(validateSpy).not.toHaveBeenCalled();
  });
});

describe('MPP session — content credentials (batch handler)', () => {
  it('voucher with body: handler runs and channel.charge() fires once per tick', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema, tickCost: '0.0001' });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        for (let i = 0; i < 7; i++) await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    await res.text(); // drain stream so generator completes
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toHaveLength(7);
  });

  it('open with body: routed as content (handler runs, channel charged)', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'open', body: { prompt: 'hi' } }));
    await res.text();
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toHaveLength(2);
  });

  it('handler that never calls charge: free request, no channel.charge calls', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async () => ({ free: true }),
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(200);
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('handler returns 4xx: response forwarded, no channel.charge calls', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!(); // billed once even though we error
        throw Object.assign(new Error('Bad input'), { status: 422 });
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(422);
    // No SSE generator engaged on error path → no controller.charge calls.
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('handler throws without status: returns 500 unmetered', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('boom');
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(500);
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('charge() throws when running total exceeds maxPrice', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({
      bodySchema,
      tickCost: '0.01',
      maxPrice: '0.02', // only 2 ticks fit
    });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        await charge!();
        await charge!(); // exceeds cap
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(400);
    // No body emitted on cap error — no channel.charge calls reach the SSE stream.
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('billed amount = tickCost * call count, regardless of yield count', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({
      bodySchema,
      tickCost: '0.0005',
      maxPrice: '0.10',
    });
    let observedSettledAmount: string | null = null;
    const handler = createRequestHandler(
      {
        ...entry,
        settlement: {
          afterSettle: async (ctx) => {
            observedSettledAmount = ctx.payment.amount;
          },
        },
      },
      async ({ charge }) => {
        for (let i = 0; i < 4; i++) await charge!();
        return { tokens: 4 };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    await res.text();
    // 4 calls × $0.0005 = $0.002
    expect(observedSettledAmount).toBe('0.002');
    expect(fake.state.chargeCalls).toHaveLength(4);
  });
});

describe('MPP session — streaming handlers', () => {
  it('async generator: charge() inside handler debits the channel live', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema, tickCost: '0.0001' });
    const handler = createRequestHandler(
      entry,
      async function* ({ charge }) {
        for (let i = 0; i < 3; i++) {
          await charge!();
          yield `chunk-${i}`;
        }
        yield 'done';
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('chunk-0');
    expect(body).toContain('done');
    expect(fake.state.chargeCalls).toHaveLength(3);
  });

  it('async generator without charge() calls: zero channel debits, body still streams', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async function* () {
        yield 'a';
        yield 'b';
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    const body = await res.text();
    expect(body).toBe('ab');
    expect(fake.state.chargeCalls).toEqual([]);
  });

  it('async generator: channel.charge() throwing mid-stream surfaces as stream error', async () => {
    const fake = createFakeSessionMppx({
      channelChargeBehavior: async (idx) => {
        if (idx === 1) throw new Error('ChannelClosedError');
      },
    });
    const entry = makeDynamicSessionEntry({ bodySchema, tickCost: '0.0001' });
    const handler = createRequestHandler(
      entry,
      async function* ({ charge }) {
        await charge!();
        yield 'first';
        await charge!(); // throws
        yield 'never';
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(res.status).toBe(200);
    await expect(res.text()).rejects.toThrow(/ChannelClosedError/);
    expect(fake.state.chargeCalls).toHaveLength(2);
  });
});

describe('MPP session — registration validation', () => {
  function makeBuilder(deps: OrchestrateDeps) {
    return new RouteBuilder('test/route', new RouteRegistry(), deps);
  }

  it('throws when .paid({ dynamic: true }) on MPP route without session config', () => {
    const fake = createFakeSessionMppx();
    const deps = makeSessionDeps(fake);
    deps.mppSessionConfig = null; // no session config
    const builder = makeBuilder(deps);
    expect(() =>
      builder
        .paid({ dynamic: true, maxPrice: '0.05', tickCost: '0.0001', protocols: ['mpp'] })
        .body(bodySchema)
        .handler(async () => ({})),
    ).toThrow(/requires session mode/);
  });

  it('throws when .paid({ dynamic: true }) without tickCost', () => {
    const fake = createFakeSessionMppx();
    const builder = makeBuilder(makeSessionDeps(fake));
    expect(() => builder.paid({ dynamic: true, maxPrice: '0.05', protocols: ['mpp'] })).toThrow(
      /requires tickCost/,
    );
  });

  it('throws when .paid({ dynamic: true }) on x402 route without upto accept', () => {
    const fake = createFakeSessionMppx();
    const deps = makeSessionDeps(fake);
    deps.x402Accepts = [{ scheme: 'exact', network: 'eip155:8453', payTo: KNOWN_PAYEE }];
    const builder = makeBuilder(deps);
    expect(() =>
      builder
        .paid({ dynamic: true, maxPrice: '0.05', tickCost: '0.0001', protocols: ['x402'] })
        .body(bodySchema)
        .handler(async () => ({})),
    ).toThrow(/requires an 'upto' accept/);
  });
});

// ---------------------------------------------------------------------------
// Settle epilogue — afterSettle / onPaymentSettled fire for both batch and
// streaming session settle paths (regression coverage for the streaming
// epilogue gap that was previously skipping these hooks).
// ---------------------------------------------------------------------------

describe('MPP session — settle epilogue', () => {
  it('content: afterSettle fires with settled metadata after handler', async () => {
    const fake = createFakeSessionMppx();
    let captured: SettlementSettledContext | null = null;
    const entry = makeDynamicSessionEntry({
      bodySchema,
      settlement: {
        afterSettle: async (ctx) => {
          captured = ctx as SettlementSettledContext;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    await res.text();
    expect(captured).not.toBeNull();
    expect(captured!.payment.status).toBe('settled');
    expect(captured!.payment.protocol).toBe('mpp');
    expect(captured!.payment.amount).toBe('0.0001');
    expect(captured!.payment.receipt).toBe('MOCK_SESSION_RECEIPT');
  });

  it('content: onPaymentSettled plugin hook fires with settled event', async () => {
    const fake = createFakeSessionMppx();
    const events: SettlementEvent[] = [];
    const plugin: RouterPlugin = {
      onPaymentSettled(_ctx, evt) {
        events.push(evt);
      },
    };
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake, { plugin }),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    await res.text();
    expect(events).toHaveLength(1);
    expect(events[0]!.protocol).toBe('mpp');
    expect(events[0]!.payer).toBe(KNOWN_PAYER.toLowerCase());
  });

  it('streaming: afterSettle fires at stream-start with settled metadata', async () => {
    const fake = createFakeSessionMppx();
    let captured: SettlementSettledContext | null = null;
    const entry = makeDynamicSessionEntry({
      bodySchema,
      settlement: {
        afterSettle: async (ctx) => {
          captured = ctx as SettlementSettledContext;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async function* ({ charge }) {
        await charge!();
        yield 'hi';
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    // afterSettle runs synchronously before the response is returned —
    // assert without waiting for the body to drain.
    expect(captured).not.toBeNull();
    expect(captured!.payment.status).toBe('settled');
    expect(captured!.payment.protocol).toBe('mpp');
    await res.text();
  });

  it('streaming: onPaymentSettled fires at stream-start', async () => {
    const fake = createFakeSessionMppx();
    const events: SettlementEvent[] = [];
    const plugin: RouterPlugin = {
      onPaymentSettled(_ctx, evt) {
        events.push(evt);
      },
    };
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async function* ({ charge }) {
        await charge!();
        yield 'hi';
      },
      makeSessionDeps(fake, { plugin }),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    expect(events).toHaveLength(1);
    expect(events[0]!.protocol).toBe('mpp');
    await res.text();
  });

  it('content: ctx.payment carries Payment-Receipt from mppx response', async () => {
    const fake = createFakeSessionMppx();
    let observed: HandlerPaymentContext | null = null;
    const entry = makeDynamicSessionEntry({
      bodySchema,
      settlement: {
        afterSettle: async (ctx) => {
          observed = ctx.payment;
        },
      },
    });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );
    const res = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'hi' } }));
    await res.text();
    expect(observed?.receipt).toBe('MOCK_SESSION_RECEIPT');
  });
});

// ---------------------------------------------------------------------------
// Multi-request — same channel, multiple sequential requests.
// ---------------------------------------------------------------------------

describe('MPP session — multi-request channel', () => {
  it('charge counts accumulate across sequential voucher+body requests', async () => {
    const fake = createFakeSessionMppx();
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );

    const r1 = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'a' } }));
    await r1.text();
    expect(fake.state.chargeCalls).toHaveLength(2);

    const r2 = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'b' } }));
    await r2.text();
    expect(fake.state.chargeCalls).toHaveLength(4);
  });

  it('open then voucher: both succeed on the same route, only voucher meters', async () => {
    const fake = createFakeSessionMppx();
    // bodySchema is fine — preflight skips body for the bodyless open.
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        if (charge) await charge();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );

    const open = await handler(withSessionCredential({ action: 'open' }));
    expect(open.status).toBe(200);
    expect(fake.state.chargeCalls).toEqual([]); // channel-only path

    const voucher = await handler(
      withSessionCredential({ action: 'voucher', body: { prompt: 'a' } }),
    );
    await voucher.text();
    expect(fake.state.chargeCalls).toHaveLength(1);
  });

  it('subsequent request after channel exhaustion returns 402 to client', async () => {
    // First session() call succeeds, second onwards returns 402 (mppx signals
    // the client must top up the channel before continuing).
    const fake = createFakeSessionMppx({ rejectAfter: 1 });
    const entry = makeDynamicSessionEntry({ bodySchema });
    const handler = createRequestHandler(
      entry,
      async ({ charge }) => {
        await charge!();
        return { ok: true };
      },
      makeSessionDeps(fake),
    );

    const r1 = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'a' } }));
    await r1.text();
    expect(r1.status).toBe(200);
    expect(fake.state.chargeCalls).toHaveLength(1);

    const r2 = await handler(withSessionCredential({ action: 'voucher', body: { prompt: 'b' } }));
    expect(r2.status).toBe(402);
    expect(fake.state.chargeCalls).toHaveLength(1); // no new charges
  });
});
