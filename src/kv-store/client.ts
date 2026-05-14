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

interface RestResponse<T> {
  result?: T;
  error?: string;
}

const BIGINT_SUFFIX = '#__bigint';

function stringifyValue(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    typeof v === 'bigint' ? `${v.toString()}${BIGINT_SUFFIX}` : v,
  );
}

function parseValue(raw: string): unknown {
  return JSON.parse(raw, (_key, v) =>
    typeof v === 'string' && v.endsWith(BIGINT_SUFFIX)
      ? BigInt(v.slice(0, -BIGINT_SUFFIX.length))
      : v,
  );
}

function restKvStore(url: string, token: string): KvStore {
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
    const body = (await res.json()) as RestResponse<T>;
    if (body.error) throw new Error(`[kv-store] ${command[0]}: ${body.error}`);
    return body.result ?? null;
  }

  async function get(key: string): Promise<unknown> {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, { headers: authHeader });
    if (!res.ok) throw new Error(`[kv-store] GET ${key}: ${res.status}`);
    const { result } = (await res.json()) as RestResponse<unknown>;
    if (result == null) return null;
    if (typeof result !== 'string') return result;
    try {
      return parseValue(result);
    } catch {
      return result;
    }
  }

  async function set(key: string, value: unknown): Promise<void> {
    await exec(['SET', key, stringifyValue(value)]);
  }

  async function del(key: string): Promise<void> {
    await exec(['DEL', key]);
  }

  async function setNxEx(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const result = await exec<string>([
      'SET',
      key,
      stringifyValue(value),
      'EX',
      ttlSeconds,
      'NX',
    ]);
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

function isRestConfig(input: unknown): input is { url: string; token: string } {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { url?: unknown }).url === 'string' &&
    typeof (input as { token?: unknown }).token === 'string' &&
    typeof (input as Partial<KvStore>).get !== 'function'
  );
}

export function resolveKvStore(
  input: KvStore | { url: string; token: string } | undefined,
  env: NodeJS.ProcessEnv = process.env,
): KvStore | undefined {
  if (input) {
    if (isRestConfig(input)) return restKvStore(input.url, input.token);
    return input;
  }
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (url && token) return restKvStore(url, token);
  return undefined;
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
