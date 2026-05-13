import type { Store } from 'mppx';
import type { KvStore } from './client.js';
import { withPrefix } from './client.js';

type MppStore = Store.Store;

export interface KvMppStoreOptions {
  /** Key prefix. Default: `'mpp:'`. */
  prefix?: string;
}

/** Build an mppx-compatible Store from a KvStore (namespaced under `'mpp:'` by default). */
export async function createKvMppStore(
  kv: KvStore,
  options?: KvMppStoreOptions,
): Promise<MppStore> {
  const prefix = options?.prefix ?? 'mpp:';
  const namespaced = withPrefix(kv, prefix);
  const { Store: StoreNs } = await import('mppx');
  return StoreNs.upstash({
    get: (key) => namespaced.get(key),
    set: (key, value) => namespaced.set(key, value),
    del: (key) => namespaced.del(key),
    update: (key, fn) => namespaced.update(key, fn),
  });
}
