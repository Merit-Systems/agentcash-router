import { createAgentIdentityNonceStore } from '../../src/kv-store/index.js';

export function makeTestAgentIdentityNonceStore() {
  return createAgentIdentityNonceStore();
}
