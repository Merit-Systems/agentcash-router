import type { Store } from 'mppx';
import type { RouterConfig } from '../types.js';

type MppStore = Store.Store;

export async function resolveMppStore(
  mpp: NonNullable<RouterConfig['mpp']>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MppStore | undefined> {
  if (mpp.store) return mpp.store;
  if (!mpp.useDefaultStore) return undefined;

  const kvUrl = env.KV_REST_API_URL;
  const kvToken = env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    throw new Error(
      'mpp.useDefaultStore requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables. ' +
        'These are automatically set by Vercel KV.',
    );
  }

  const { Store: StoreNs } = await import('mppx');
  const { createUpstashRest } = await import('../upstash-rest.js');
  return StoreNs.upstash(createUpstashRest(kvUrl, kvToken));
}
