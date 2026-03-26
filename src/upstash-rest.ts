import type { Store } from 'mppx';

/**
 * Minimal Upstash REST client that satisfies {@link Store.upstash.Parameters}.
 *
 * Uses raw `fetch` — zero npm dependencies beyond what the router already has.
 * Compatible with Vercel KV env vars (`KV_REST_API_URL` + `KV_REST_API_TOKEN`).
 */
export function createUpstashRest(url: string, token: string): Store.upstash.Parameters {
  const base = url.replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}` };

  return {
    async get(key: string): Promise<unknown> {
      const res = await fetch(`${base}/get/${key}`, { headers });
      if (!res.ok) throw new Error(`[upstash-rest] GET ${key}: ${res.status}`);
      const { result } = (await res.json()) as { result: unknown };
      return result ?? null;
    },
    async set(key: string, value: unknown): Promise<unknown> {
      const res = await fetch(`${base}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', key, JSON.stringify(value)]),
      });
      if (!res.ok) throw new Error(`[upstash-rest] SET ${key}: ${res.status}`);
      return (await res.json()) as { result: string };
    },
    async del(key: string): Promise<unknown> {
      const res = await fetch(`${base}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(['DEL', key]),
      });
      if (!res.ok) throw new Error(`[upstash-rest] DEL ${key}: ${res.status}`);
      return (await res.json()) as { result: number };
    },
  };
}
