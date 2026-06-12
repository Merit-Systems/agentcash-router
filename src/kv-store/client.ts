/**
 * Minimal key-value contract backing SIWX nonce replay, SIWX entitlement, and
 * MPP channel/replay state.
 *
 * Custom implementations MUST make {@link KvStore.update} an atomic
 * read-modify-write — see its doc comment. Every other method is a plain
 * single-key operation.
 */
export interface KvStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  setNxEx(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  sadd(key: string, member: string): Promise<void>;
  sismember(key: string, member: string): Promise<boolean>;
  /**
   * Atomic read-modify-write for a single key.
   *
   * Implementations MUST guarantee atomicity: a concurrent write between the
   * read and the conditional write must not be lost (e.g. via optimistic
   * compare-and-set with retry, a Lua script, or a transaction). This backs
   * MPP channel-state deductions — a plain GET→fn→SET implementation can
   * double-spend under concurrent requests.
   *
   * `fn` receives the current value (or `null` when the key is absent) and
   * must be synchronous, side-effect free, and tolerant of being invoked
   * multiple times: optimistic implementations re-run it on write conflicts.
   */
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

/** Bounded optimistic-CAS retries for `update` before giving up. */
const UPDATE_MAX_RETRIES = 8;

// Compare-and-set: apply the write only when the key's current value still
// matches what the caller read (ARGV[1] = '1' when a value was read, ARGV[2] =
// that raw value; ARGV[1] = '0' when the key was absent). `KEEPTTL` preserves
// any TTL already set on the key across the conditional SET.
const CAS_UPDATE_SCRIPT = `local cur = redis.call('GET', KEYS[1])
if ARGV[1] == '1' then
  if cur == false or cur ~= ARGV[2] then return 0 end
else
  if cur ~= false then return 0 end
end
if ARGV[3] == 'set' then
  redis.call('SET', KEYS[1], ARGV[4], 'KEEPTTL')
else
  redis.call('DEL', KEYS[1])
end
return 1`;

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

  async function fetchResult(key: string): Promise<unknown> {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, { headers: authHeader });
    if (!res.ok) throw new Error(`[kv-store] GET ${key}: ${res.status}`);
    const { result } = (await res.json()) as RestResponse<unknown>;
    return result ?? null;
  }

  async function get(key: string): Promise<unknown> {
    const result = await fetchResult(key);
    if (result == null) return null;
    if (typeof result !== 'string') return result;
    try {
      return parseValue(result);
    } catch {
      return result;
    }
  }

  /** Raw serialized value as stored — the CAS comparand for `update`. */
  async function getRaw(key: string): Promise<string | null> {
    const result = await fetchResult(key);
    if (result == null) return null;
    return typeof result === 'string' ? result : String(result);
  }

  async function set(key: string, value: unknown): Promise<void> {
    await exec(['SET', key, stringifyValue(value)]);
  }

  async function del(key: string): Promise<void> {
    await exec(['DEL', key]);
  }

  async function setNxEx(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const result = await exec<string>(['SET', key, stringifyValue(value), 'EX', ttlSeconds, 'NX']);
    return result === 'OK';
  }

  async function sadd(key: string, member: string): Promise<void> {
    await exec(['SADD', key, member]);
  }

  async function sismember(key: string, member: string): Promise<boolean> {
    const result = await exec<number>(['SISMEMBER', key, member]);
    return result === 1;
  }

  // Optimistic compare-and-set: read, run fn, then write conditionally on the
  // value being unchanged (Lua EVAL). On conflict, re-read and re-run fn —
  // mppx's Store contract requires atomicity here and documents that fn may
  // be retried.
  async function update<R>(key: string, fn: (current: unknown) => KvChange<R>): Promise<R> {
    for (let attempt = 0; attempt < UPDATE_MAX_RETRIES; attempt++) {
      const currentRaw = await getRaw(key);
      let current: unknown = null;
      if (currentRaw !== null) {
        try {
          current = parseValue(currentRaw);
        } catch {
          current = currentRaw;
        }
      }
      const change = fn(current);
      if (change.op === 'noop') return change.result;
      const applied = await exec<number>([
        'EVAL',
        CAS_UPDATE_SCRIPT,
        1,
        key,
        currentRaw === null ? '0' : '1',
        currentRaw ?? '',
        change.op === 'set' ? 'set' : 'del',
        change.op === 'set' ? stringifyValue(change.value) : '',
      ]);
      if (applied === 1) return change.result;
    }
    throw new Error(
      `[kv-store] update ${key}: write conflict persisted after ${UPDATE_MAX_RETRIES} attempts`,
    );
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
  env: Record<string, string | undefined> = process.env,
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
