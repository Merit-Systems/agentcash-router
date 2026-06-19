import { NonceStore, type NonceRecord, type NonceStoreInterface } from 'did-auth-challenge';
import type { KvStore } from './client.js';

export interface KvAgentIdentityNonceStoreOptions {
  prefix?: string;
}

function createKvAgentIdentityNonceStore(
  kv: KvStore,
  options?: KvAgentIdentityNonceStoreOptions,
): NonceStoreInterface {
  const prefix = options?.prefix ?? 'actor:nonce:';

  return {
    async add(nonce: string, expiresAt: Date, challengeJson: string): Promise<void> {
      const ttl = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      const record: NonceRecord = { challengeJson, expiresAt: expiresAt.getTime() };
      await kv.setNxEx(`${prefix}${nonce}`, record, ttl);
    },

    async get(nonce: string): Promise<NonceRecord | null> {
      const raw = await kv.get(`${prefix}${nonce}`);
      if (!raw) return null;
      const record = raw as NonceRecord;
      if (Date.now() > record.expiresAt) {
        await kv.del(`${prefix}${nonce}`);
        return null;
      }
      return record;
    },

    async has(nonce: string): Promise<boolean> {
      return (await this.get(nonce)) !== null;
    },

    async consume(nonce: string): Promise<NonceRecord | null> {
      return kv.update(`${prefix}${nonce}`, (current) => {
        if (!current) return { op: 'noop', result: null };
        const record = current as NonceRecord;
        if (Date.now() > record.expiresAt) {
          return { op: 'delete', result: null };
        }
        return { op: 'delete', result: record };
      });
    },
  };
}

export function createAgentIdentityNonceStore(kv?: KvStore): NonceStoreInterface {
  return kv ? createKvAgentIdentityNonceStore(kv) : new NonceStore();
}
