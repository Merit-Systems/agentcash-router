import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUpstashRest } from '../src/upstash-rest.js';

describe('createUpstashRest', () => {
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

    const client = createUpstashRest(url, token);
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

    const client = createUpstashRest(url, token);
    const result = await client.get('missing-key');

    expect(result).toBeNull();
  });

  it('set() sends POST with JSON array command', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'OK' }),
    });

    const client = createUpstashRest(url, token);
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

    const client = createUpstashRest(url, token);
    await client.del('my-key');

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', 'my-key']),
    });
  });

  it('strips trailing slashes from base URL', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: null }),
    });

    const client = createUpstashRest(`${url}///`, token);
    await client.get('key');

    expect(fetchSpy).toHaveBeenCalledWith(`${url}/get/key`, expect.any(Object));
  });

  it('throws on non-200 responses', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });

    const client = createUpstashRest(url, token);
    await expect(client.get('key')).rejects.toThrow('[upstash-rest] GET key: 401');
  });
});
