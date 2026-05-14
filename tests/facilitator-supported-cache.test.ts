import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FacilitatorClient } from '@x402/core/http';
import { withCachedSupported } from '../src/kv-store/facilitator-supported.js';

type SupportedResponse = Awaited<ReturnType<FacilitatorClient['getSupported']>>;

const realResponse: SupportedResponse = {
  kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' }],
  extensions: [],
  signers: {},
};

const fallbackResponse: SupportedResponse = {
  kinds: [
    { x402Version: 2, scheme: 'exact', network: 'eip155:8453' },
    { x402Version: 2, scheme: 'upto', network: 'eip155:8453' },
  ],
  extensions: [],
  signers: {},
};

function makeInner(impl: () => Promise<SupportedResponse>): FacilitatorClient {
  return {
    getSupported: impl,
    verify: vi.fn() as unknown as FacilitatorClient['verify'],
    settle: vi.fn() as unknown as FacilitatorClient['settle'],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withCachedSupported', () => {
  it('returns the live response when getSupported resolves', async () => {
    const inner = makeInner(async () => realResponse);
    const client = withCachedSupported(inner, { fallback: () => fallbackResponse });
    await expect(client.getSupported()).resolves.toBe(realResponse);
  });

  it('returns the fallback when getSupported rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = makeInner(async () => {
      throw new Error('facilitator unreachable');
    });
    const client = withCachedSupported(inner, { fallback: () => fallbackResponse });
    await expect(client.getSupported()).resolves.toEqual(fallbackResponse);
  });

  it('rethrows when getSupported rejects and no fallback is provided', async () => {
    const inner = makeInner(async () => {
      throw new Error('boom');
    });
    const client = withCachedSupported(inner);
    await expect(client.getSupported()).rejects.toThrow('boom');
  });

  it('does not pin a rejected inflight — next call retries the inner', async () => {
    const inner = {
      getSupported: vi
        .fn<() => Promise<SupportedResponse>>()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(realResponse),
      verify: vi.fn() as unknown as FacilitatorClient['verify'],
      settle: vi.fn() as unknown as FacilitatorClient['settle'],
    };
    const client = withCachedSupported(inner);

    await expect(client.getSupported()).rejects.toThrow('transient');
    await expect(client.getSupported()).resolves.toBe(realResponse);
    expect(inner.getSupported).toHaveBeenCalledTimes(2);
  });

  it('dedups concurrent in-process calls', async () => {
    let resolveLive: (value: SupportedResponse) => void = () => undefined;
    const inner = {
      getSupported: vi.fn<() => Promise<SupportedResponse>>().mockImplementation(
        () =>
          new Promise<SupportedResponse>((resolve) => {
            resolveLive = resolve;
          }),
      ),
      verify: vi.fn() as unknown as FacilitatorClient['verify'],
      settle: vi.fn() as unknown as FacilitatorClient['settle'],
    };
    const client = withCachedSupported(inner);

    const a = client.getSupported();
    const b = client.getSupported();
    resolveLive(realResponse);

    await expect(a).resolves.toBe(realResponse);
    await expect(b).resolves.toBe(realResponse);
    expect(inner.getSupported).toHaveBeenCalledTimes(1);
  });

  it('caches the live response in KV when cacheKey is provided', async () => {
    const kvStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      del: vi.fn(),
      setNxEx: vi.fn().mockResolvedValue(true),
      sadd: vi.fn(),
      sismember: vi.fn(),
      update: vi.fn(),
    };
    const inner = makeInner(async () => realResponse);
    const client = withCachedSupported(inner, {
      kv: kvStore,
      cacheKey: 'https://cdp.example',
      ttlSeconds: 1234,
    });

    await client.getSupported();

    expect(kvStore.get).toHaveBeenCalledWith('x402:facilitator-supported:https://cdp.example');
    expect(kvStore.setNxEx).toHaveBeenCalledWith(
      'x402:facilitator-supported:https://cdp.example',
      realResponse,
      1234,
    );
  });

  it('does not write fallback to KV when the live call fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kvStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      del: vi.fn(),
      setNxEx: vi.fn(),
      sadd: vi.fn(),
      sismember: vi.fn(),
      update: vi.fn(),
    };
    const inner = makeInner(async () => {
      throw new Error('5xx');
    });
    const client = withCachedSupported(inner, {
      kv: kvStore,
      cacheKey: 'https://cdp.example',
      fallback: () => fallbackResponse,
    });

    await client.getSupported();
    expect(kvStore.setNxEx).not.toHaveBeenCalled();
  });
});
