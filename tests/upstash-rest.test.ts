import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createUpstashRestClient,
  createKvStoreFromEnv,
  withPrefix,
} from '../src/kv-store/index.js';

describe('createUpstashRestClient', () => {
  const url = 'https://us1-test.upstash.io';
  const token = 'test-token-123';

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get() sends correct request and parses result', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: '{"foo":"bar"}' }),
    });

    const client = createUpstashRestClient(url, token);
    const result = await client.get('my-key');

    expect(fetchSpy).toHaveBeenCalledWith(`${url}/get/my-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(result).toBe('{"foo":"bar"}');
  });

  it('get() returns null when result is null', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });

    const client = createUpstashRestClient(url, token);
    const result = await client.get('missing-key');

    expect(result).toBeNull();
  });

  it('set() sends POST with JSON array command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'OK' }),
    });

    const client = createUpstashRestClient(url, token);
    await client.set('my-key', { count: 42 });

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'my-key', JSON.stringify({ count: 42 })]),
    });
  });

  it('del() sends POST with DEL command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const client = createUpstashRestClient(url, token);
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

    const client = createUpstashRestClient(url, token);
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

    const client = createUpstashRestClient(url, token);
    const ok = await client.setNxEx('my-key', 1, 60);

    expect(ok).toBe(false);
  });

  it('sadd() sends SADD command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const client = createUpstashRestClient(url, token);
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

    const client = createUpstashRestClient(url, token);
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

    const client = createUpstashRestClient(`${url}///`, token);
    await client.get('key');

    expect(fetchSpy).toHaveBeenCalledWith(`${url}/get/key`, expect.any(Object));
  });

  it('throws on non-200 responses', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });

    const client = createUpstashRestClient(url, token);
    await expect(client.get('key')).rejects.toThrow('[kv-store] GET key: 401');
  });
});

describe('createKvStoreFromEnv', () => {
  it('returns undefined when env vars are missing', () => {
    expect(createKvStoreFromEnv({})).toBeUndefined();
    expect(createKvStoreFromEnv({ KV_REST_API_URL: 'x' })).toBeUndefined();
    expect(createKvStoreFromEnv({ KV_REST_API_TOKEN: 'x' })).toBeUndefined();
  });

  it('returns a KvStore when both env vars are present', () => {
    const kv = createKvStoreFromEnv({
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: 'tok',
    });
    expect(kv).toBeDefined();
    expect(typeof kv?.get).toBe('function');
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
