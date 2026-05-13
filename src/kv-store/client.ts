export interface KvStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  setNxEx(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  sadd(key: string, member: string): Promise<void>;
  sismember(key: string, member: string): Promise<boolean>;
  update<R>(key: string, fn: (current: unknown) => KvChange<R>): Promise<R>;
}

export type KvChange<R> =
  | { op: 'noop'; result: R }
  | { op: 'set'; value: unknown; result: R }
  | { op: 'delete'; result: R };

interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export function createUpstashRestClient(url: string, token: string): KvStore {
  const base = url.replace(/\/+$/, '');
  const authHeader = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };

  async function exec<T>(command: unknown[]): Promise<T | null> {
    const res = await fetch(base, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`[kv-store] ${command[0]} ${command[1] ?? ''}: ${res.status}`);
    }
    const body = (await res.json()) as UpstashResponse<T>;
    if (body.error) throw new Error(`[kv-store] ${command[0]}: ${body.error}`);
    return body.result ?? null;
  }

  async function get(key: string): Promise<unknown> {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, { headers: authHeader });
    if (!res.ok) throw new Error(`[kv-store] GET ${key}: ${res.status}`);
    const { result } = (await res.json()) as UpstashResponse<unknown>;
    return result ?? null;
  }

  async function set(key: string, value: unknown): Promise<void> {
    await exec(['SET', key, JSON.stringify(value)]);
  }

  async function del(key: string): Promise<void> {
    await exec(['DEL', key]);
  }

  async function setNxEx(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const result = await exec<string>(['SET', key, JSON.stringify(value), 'EX', ttlSeconds, 'NX']);
    return result === 'OK';
  }

  async function sadd(key: string, member: string): Promise<void> {
    await exec(['SADD', key, member]);
  }

  async function sismember(key: string, member: string): Promise<boolean> {
    const result = await exec<number>(['SISMEMBER', key, member]);
    return result === 1;
  }

  async function update<R>(key: string, fn: (current: unknown) => KvChange<R>): Promise<R> {
    const current = await get(key);
    const change = fn(current);
    if (change.op === 'set') await set(key, change.value);
    if (change.op === 'delete') await del(key);
    return change.result;
  }

  return { get, set, del, setNxEx, sadd, sismember, update };
}

export function createKvStoreFromEnv(env: NodeJS.ProcessEnv = process.env): KvStore | undefined {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  return createUpstashRestClient(url, token);
}

export function withPrefix(kv: KvStore, prefix: string): KvStore {
  const k = (key: string) => `${prefix}${key}`;
  return {
    get: (key) => kv.get(k(key)),
    set: (key, value) => kv.set(k(key), value),
    del: (key) => kv.del(k(key)),
    setNxEx: (key, value, ttl) => kv.setNxEx(k(key), value, ttl),
    sadd: (key, member) => kv.sadd(k(key), member),
    sismember: (key, member) => kv.sismember(k(key), member),
    update: (key, fn) => kv.update(k(key), fn),
  };
}
