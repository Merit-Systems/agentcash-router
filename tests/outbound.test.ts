import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('viem', () => ({
  createPublicClient: () => ({
    readContract: vi.fn().mockResolvedValue(BigInt(500_000)),
  }),
  http: () => ({}),
}));
vi.mock('viem/chains', () => ({ base: { id: 8453 } }));
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: () => ({
    address: '0xabc' as `0x${string}`,
  }),
}));
vi.mock('@x402/core/client', () => ({
  x402Client: vi.fn().mockImplementation(() => ({})),
  x402HTTPClient: vi.fn().mockImplementation(() => ({
    getPaymentRequiredResponse: vi.fn().mockReturnValue({}),
    createPaymentPayload: vi.fn().mockResolvedValue({}),
    encodePaymentSignatureHeader: vi.fn().mockReturnValue({ 'x-payment': 'sig' }),
  })),
}));
vi.mock('@x402/evm/exact/client', () => ({
  registerExactEvmScheme: vi.fn(),
}));

import { OutboundClient } from '../src/outbound.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeClient(opts?: { lowBalanceThreshold?: number; alertUrl?: string }) {
  return new OutboundClient({
    walletKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    lowBalanceThreshold: opts?.lowBalanceThreshold ?? 0.25,
    alertUrl: opts?.alertUrl ?? '',
  });
}

describe('OutboundClient', () => {
  it('balance returns human-readable amount', async () => {
    const client = makeClient();
    const bal = await client.balance();
    expect(bal).toBe(0.5);
  });

  it('pay passes through non-402 responses', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    const client = makeClient();
    const res = await client.pay('https://example.com/api');
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('pay handles 402 → payment → retry', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 402,
          headers: { 'x-payment': 'required' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const client = makeClient();
    const res = await client.pay('https://example.com/api');
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('pay sends POST body and content-type', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const client = makeClient();
    await client.pay('https://example.com/api', {
      method: 'POST',
      body: { query: 'test' },
    });

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect((call[1] as RequestInit).method).toBe('POST');
    expect((call[1] as RequestInit).headers).toHaveProperty('content-type');
  });

  it('checkAndAlert sends alert when below threshold', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response('', { status: 200 }));

    const client = makeClient({ lowBalanceThreshold: 1.0, alertUrl: 'https://hooks.example.com' });
    const result = await client.checkAndAlert();
    expect(result.balance).toBe(0.5);
    expect(result.alerted).toBe(true);
  });

  it('checkAndAlert does not alert when above threshold', async () => {
    const client = makeClient({ lowBalanceThreshold: 0.1 });
    const result = await client.checkAndAlert();
    expect(result.alerted).toBe(false);
  });

  it('checkAndAlert does not alert without alertUrl', async () => {
    const client = makeClient({ lowBalanceThreshold: 1.0 });
    const result = await client.checkAndAlert();
    expect(result.alerted).toBe(false);
  });
});
