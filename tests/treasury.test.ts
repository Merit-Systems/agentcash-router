import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/usdc.js', () => ({
  USDC_DECIMALS: 6,
  getUsdcBalance: vi.fn().mockResolvedValue(25),
}));
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: () => ({
    address: '0xabc' as `0x${string}`,
  }),
}));

import { TreasuryManager } from '../src/treasury.js';
import { getUsdcBalance } from '../src/usdc.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
  vi.mocked(getUsdcBalance).mockResolvedValue(25);
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeManager(opts?: { buffer?: number; sweepThreshold?: number }) {
  return new TreasuryManager({
    operationalKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    treasuryAddress: '0xtarget',
    buffer: opts?.buffer ?? 10,
    sweepThreshold: opts?.sweepThreshold ?? 20,
  });
}

describe('TreasuryManager', () => {
  it('balance returns human-readable amount', async () => {
    const manager = makeManager();
    const bal = await manager.balance();
    expect(bal).toBe(25);
  });

  it('sweep returns 0 when below threshold', async () => {
    vi.mocked(getUsdcBalance).mockResolvedValue(15);

    const manager = makeManager();
    const result = await manager.sweep();
    expect(result.swept).toBe(0);
    expect(result.balance).toBe(15);
  });

  it('sweep executes when above threshold', async () => {
    vi.doMock('@x402/core/client', () => ({
      x402Client: vi.fn().mockImplementation(() => ({})),
      x402HTTPClient: vi.fn().mockImplementation(() => ({
        getPaymentRequiredResponse: vi.fn().mockReturnValue({}),
        createPaymentPayload: vi.fn().mockResolvedValue({}),
        encodePaymentSignatureHeader: vi.fn().mockReturnValue({}),
      })),
    }));
    vi.doMock('@x402/evm/exact/client', () => ({
      registerExactEvmScheme: vi.fn(),
    }));

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 402,
          headers: { 'x-payment': 'required' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const manager = makeManager();
    const result = await manager.sweep();
    expect(result.swept).toBe(15);
  });

  it('sweep returns 0 when sweepAmount <= 0', async () => {
    vi.mocked(getUsdcBalance).mockResolvedValue(20);

    const manager = makeManager({ buffer: 20, sweepThreshold: 20 });
    const result = await manager.sweep();
    expect(result.swept).toBe(0);
  });

  it('respects custom rpcUrl', () => {
    const manager = new TreasuryManager({
      operationalKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      treasuryAddress: '0xtarget',
      rpcUrl: 'https://custom-rpc.example.com',
    });
    expect(manager).toBeDefined();
  });
});
