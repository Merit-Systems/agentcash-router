import type { Store } from 'mppx';

export function createUpstashRest(url: string, token: string): Store.upstash.Parameters {
  const base = url.replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}` };

  async function get(key: string): Promise<unknown> {
    const res = await fetch(`${base}/get/${key}`, { headers });
    if (!res.ok) throw new Error(`[upstash-rest] GET ${key}: ${res.status}`);
    const { result } = (await res.json()) as { result: unknown };
    return result ?? null;
  }

  async function set(key: string, value: unknown): Promise<unknown> {
    const res = await fetch(`${base}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value)]),
    });
    if (!res.ok) throw new Error(`[upstash-rest] SET ${key}: ${res.status}`);
    return (await res.json()) as { result: string };
  }

  async function del(key: string): Promise<unknown> {
    const res = await fetch(`${base}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', key]),
    });
    if (!res.ok) throw new Error(`[upstash-rest] DEL ${key}: ${res.status}`);
    return (await res.json()) as { result: number };
  }

  return {
    get,
    set,
    del,
    async update<result>(
      key: string,
      fn: (current: unknown) => Store.Change<unknown, result>,
    ): Promise<result> {
      const current = await get(key);
      const change = fn(current);
      if (change.op === 'set') await set(key, change.value);
      if (change.op === 'delete') await del(key);
      return change.result;
    },
  };
}
