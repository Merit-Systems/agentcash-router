import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { x402Strategy } from '../src/protocols/x402/strategy.js';
import type { SettleArgs } from '../src/protocols/types.js';
import type { HandlerPaymentContext, RouteEntry } from '../src/types.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';

type SettleResult = { success: boolean; errorReason?: string; transaction?: string };

/** FakeX402Server whose settlePayment walks a scripted list of outcomes. */
class ScriptedSettleServer extends FakeX402Server {
  attempts = 0;

  constructor(private script: Array<SettleResult | Error>) {
    super();
  }

  override async settlePayment(
    _payload: unknown,
    requirements: unknown,
    _declaredExtensions?: Record<string, unknown>,
    _transportContext?: unknown,
    _overrides?: { amount?: string },
  ) {
    const step = this.script[Math.min(this.attempts, this.script.length - 1)]!;
    this.attempts += 1;
    if (step instanceof Error) throw step;
    return {
      ...step,
      payer: KNOWN_PAYER,
      transaction: step.transaction ?? '',
      network: ((requirements as { network?: string } | null)?.network ?? 'eip155:8453') as string,
    };
  }
}

function makeSettleArgs(server: ScriptedSettleServer, report = vi.fn()): SettleArgs {
  const payment: HandlerPaymentContext = {
    protocol: 'x402',
    status: 'verified',
    payer: KNOWN_PAYER,
    amount: '0.02',
    network: 'eip155:8453',
    recipient: KNOWN_PAYEE,
  };
  return {
    request: new Request('http://localhost:3000/api/test', { method: 'POST' }),
    response: new Response(null, { status: 200 }),
    payment,
    token: {
      payload: { payer: KNOWN_PAYER },
      requirements: {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '20000',
        asset: 'mock-usdc',
        payTo: KNOWN_PAYEE,
        maxTimeoutSeconds: 300,
      },
    },
    routeEntry: {
      key: 'test/route',
      authMode: 'paid',
      billing: 'exact',
      pricing: '0.02',
      protocols: ['x402'],
      method: 'POST',
    } as RouteEntry,
    deps: { x402Server: server } as unknown as SettleArgs['deps'],
    billedAmount: '0.02',
    report,
  };
}

/**
 * Drives x402Strategy.settle under fake timers: real async work (the lazy
 * @x402/core import, fake settlePayment promises) progresses via setImmediate
 * (left unfaked), while the retry backoff's setTimeout is fast-forwarded.
 */
async function settleWithTimers(args: SettleArgs) {
  const promise = x402Strategy.settle(args);
  let done = false;
  void promise.finally(() => {
    done = true;
  });
  while (!done) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi.runAllTimersAsync();
  }
  return promise;
}

describe('x402 settle retry classification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a thrown (network/timeout) error and succeeds on the next attempt', async () => {
    const server = new ScriptedSettleServer([
      new Error('fetch failed: socket timeout'),
      { success: true, transaction: '0xTX' },
    ]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    expect(outcome.ok).toBe(true);
    expect(server.attempts).toBe(2);
    expect(report).toHaveBeenCalledWith('warn', 'Retrying x402 settlement', {
      attempt: 1,
      error: 'fetch failed: socket timeout',
    });
    if (outcome.ok) {
      expect(outcome.settledPayment.transaction).toBe('0xTX');
      expect(outcome.response.headers.get('PAYMENT-RESPONSE')).toBeTruthy();
    }
  });

  it('exhausts the retry budget when every attempt throws', async () => {
    const server = new ScriptedSettleServer([new Error('ECONNRESET')]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    expect(outcome.ok).toBe(false);
    expect(server.attempts).toBe(3); // 1 initial + 2 retries
    expect(report).toHaveBeenCalledWith(
      'error',
      'Settlement failed',
      expect.objectContaining({ error: 'ECONNRESET' }),
    );
  });

  it('fails immediately on a deterministic errorReason without retrying', async () => {
    const server = new ScriptedSettleServer([
      { success: false, errorReason: 'invalid_exact_evm_insufficient_balance' },
      { success: true }, // must never be reached
    ]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    expect(outcome.ok).toBe(false);
    expect(server.attempts).toBe(1);
    expect(report).not.toHaveBeenCalledWith('warn', 'Retrying x402 settlement', expect.anything());
  });

  it('keeps retrying unknown / free-text reasons (transient facilitator class)', async () => {
    const server = new ScriptedSettleServer([
      { success: false, errorReason: 'CDP facilitator has insufficient funds' },
      { success: false, errorReason: 'CDP facilitator has insufficient funds' },
      { success: true, transaction: '0xTX' },
    ]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    expect(outcome.ok).toBe(true);
    expect(server.attempts).toBe(3);
  });

  it('reports critical double-settle ambiguity when a throw precedes nonce-already-used', async () => {
    const server = new ScriptedSettleServer([
      new Error('fetch failed: socket timeout'), // settlement state unknown
      { success: false, errorReason: 'invalid_exact_evm_nonce_already_used' },
    ]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    // Failure semantics preserved: no invented success.
    expect(outcome.ok).toBe(false);
    expect(server.attempts).toBe(2);
    expect(report).toHaveBeenCalledWith(
      'critical',
      expect.stringContaining('possible double-settle ambiguity'),
      { errorReason: 'invalid_exact_evm_nonce_already_used' },
    );
  });

  it('does not report ambiguity for nonce reuse without a preceding throw', async () => {
    const server = new ScriptedSettleServer([
      { success: false, errorReason: 'invalid_exact_evm_nonce_already_used' },
    ]);
    const report = vi.fn();

    const outcome = await settleWithTimers(makeSettleArgs(server, report));

    expect(outcome.ok).toBe(false);
    expect(server.attempts).toBe(1);
    expect(report).not.toHaveBeenCalledWith('critical', expect.anything(), expect.anything());
  });
});
