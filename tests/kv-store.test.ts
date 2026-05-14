import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveKvStore, withPrefix, type KvStore } from '../src/kv-store/index.js';

const url = 'https://us1-test.upstash.io';
const token = 'test-token-123';

function expectKvStore(input: unknown): KvStore {
  if (!input) throw new Error('expected KvStore, got undefined');
  return input as KvStore;
}

describe('resolveKvStore with { url, token }', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get() JSON-parses the stored value (symmetric with set/setNxEx)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: JSON.stringify({ foo: 'bar' }) }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    const result = await client.get('my-key');

    expect(fetchSpy).toHaveBeenCalledWith(`${url}/get/my-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('get() round-trips numbers stored via setNxEx', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ result: '1' }) });
    const client = expectKvStore(resolveKvStore({ url, token }));
    await expect(client.get('nonce')).resolves.toBe(1);
  });

  it('get() falls back to the raw string when the value is not JSON', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'plain-text' }) });
    const client = expectKvStore(resolveKvStore({ url, token }));
    await expect(client.get('legacy')).resolves.toBe('plain-text');
  });

  it('get() returns null when result is null', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    const result = await client.get('missing-key');

    expect(result).toBeNull();
  });

  it('set() sends POST with JSON array command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'OK' }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    await client.set('my-key', { count: 42 });

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'my-key', JSON.stringify({ count: 42 })]),
    });
  });

  it('set() / get() round-trip BigInt values (mppx channel state)', async () => {
    let stored: string | undefined;
    fetchSpy.mockImplementation((async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const [, , payload] = JSON.parse(init.body as string) as [string, string, string];
        stored = payload;
        return { ok: true, json: async () => ({ result: 'OK' }) } as Response;
      }
      return { ok: true, json: async () => ({ result: stored ?? null }) } as Response;
    }) as unknown as typeof fetchSpy);

    const client = expectKvStore(resolveKvStore({ url, token }));
    await client.set('channel', { balance: 1234567890123456789n, channelId: '0xabc' });
    const read = (await client.get('channel')) as { balance: bigint; channelId: string };

    expect(stored).toContain('#__bigint');
    expect(typeof read.balance).toBe('bigint');
    expect(read.balance).toBe(1234567890123456789n);
    expect(read.channelId).toBe('0xabc');
  });

  it('del() sends POST with DEL command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    await client.del('my-key');

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', 'my-key']),
    });
  });

  it('setNxEx() sends SET ... EX ttl NX and returns true on OK', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'OK' }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    const ok = await client.setNxEx('my-key', 1, 60);

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'my-key', '1', 'EX', 60, 'NX']),
    });
    expect(ok).toBe(true);
  });

  it('setNxEx() returns false when key already exists', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    const ok = await client.setNxEx('my-key', 1, 60);

    expect(ok).toBe(false);
  });

  it('sadd() sends SADD command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    await client.sadd('my-set', 'member-a');

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SADD', 'my-set', 'member-a']),
    });
  });

  it('sismember() returns true for 1, false for 0', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const client = expectKvStore(resolveKvStore({ url, token }));
    expect(await client.sismember('my-set', 'a')).toBe(true);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 0 }),
    });
    expect(await client.sismember('my-set', 'b')).toBe(false);
  });

  it('strips trailing slashes from base URL', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });

    const client = expectKvStore(resolveKvStore({ url: `${url}///`, token }));
    await client.get('key');

    expect(fetchSpy).toHaveBeenCalledWith(`${url}/get/key`, expect.any(Object));
  });

  it('throws on non-200 responses', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });

    const client = expectKvStore(resolveKvStore({ url, token }));
    await expect(client.get('key')).rejects.toThrow('[kv-store] GET key: 401');
  });
});

describe('resolveKvStore env fallback', () => {
  it('returns undefined when both input and env vars are missing', () => {
    expect(resolveKvStore(undefined, {})).toBeUndefined();
    expect(resolveKvStore(undefined, { KV_REST_API_URL: 'x' })).toBeUndefined();
    expect(resolveKvStore(undefined, { KV_REST_API_TOKEN: 'x' })).toBeUndefined();
  });

  it('builds a KvStore from KV_REST_API_URL + KV_REST_API_TOKEN', () => {
    const kv = resolveKvStore(undefined, {
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: 'tok',
    });
    expect(kv).toBeDefined();
    expect(typeof kv?.get).toBe('function');
  });

  it('passes through a custom KvStore implementation unchanged', () => {
    const custom: KvStore = {
      get: async () => null,
      set: async () => {},
      del: async () => {},
      setNxEx: async () => true,
      sadd: async () => {},
      sismember: async () => false,
      update: async (_k, fn) => fn(null).result as never,
    };
    expect(resolveKvStore(custom)).toBe(custom);
  });
});

describe('withPrefix', () => {
  it('prefixes all key arguments', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const base = {
      async get(key: string) {
        calls.push(['get', key]);
        return null;
      },
      async set(key: string, value: unknown) {
        calls.push(['set', key, value]);
      },
      async del(key: string) {
        calls.push(['del', key]);
      },
      async setNxEx(key: string, value: unknown, ttl: number) {
        calls.push(['setNxEx', key, value, ttl]);
        return true;
      },
      async sadd(key: string, member: string) {
        calls.push(['sadd', key, member]);
      },
      async sismember(key: string, member: string) {
        calls.push(['sismember', key, member]);
        return false;
      },
      async update<R>(key: string, fn: (c: unknown) => { op: 'noop'; result: R }) {
        calls.push(['update', key]);
        return fn(null).result;
      },
    };

    const prefixed = withPrefix(base, 'p:');
    await prefixed.get('a');
    await prefixed.set('a', 1);
    await prefixed.del('a');
    await prefixed.setNxEx('a', 1, 60);
    await prefixed.sadd('a', 'm');
    await prefixed.sismember('a', 'm');

    expect(calls.map((c) => c[1])).toEqual(['p:a', 'p:a', 'p:a', 'p:a', 'p:a', 'p:a']);
  });
});
