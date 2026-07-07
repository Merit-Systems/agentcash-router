import { describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createChallenge } from 'did-auth-challenge';
import { createRequestHandler } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore, MemoryEntitlementStore } from '../src/kv-store/index.js';
import { createAgentIdentityNonceStore } from '../src/kv-store/index.js';
import {
  attachAgentIdentityChallenge,
  buildAgentIdentityChallengeHeader,
  resolveActor,
} from '../src/auth/agent-identity.js';
import { HEADERS } from '../src/headers.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';
import { makeTestAgentIdentityNonceStore } from './fakes/agent-identity-deps.js';
import type { RouteEntry } from '../src/types.js';
import type { RouterDeps } from '../src/pipeline/orchestrate.js';

const TEST_ACCOUNT = privateKeyToAccount(generatePrivateKey());
const TEST_DID = `did:pkh:eip155:8453:${TEST_ACCOUNT.address}`;

function decodeAgentHeader(header: string) {
  return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as {
    v: number;
    challenge: Record<string, unknown>;
    did?: string;
    signature?: string;
  };
}

function makePaidEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    billing: 'exact',
    pricing: '0.02',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeUnprotectedEntry(): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'unprotected',
    billing: 'exact',
    pricing: '0',
    protocols: ['x402'],
    method: 'POST',
  };
}

function makeDeps(nonceStore = makeTestAgentIdentityNonceStore()): RouterDeps {
  const server = new FakeX402Server();
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    agentIdentityNonceStore: nonceStore,
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'eip155:8453',
    x402Accepts: [{ network: 'eip155:8453', payTo: KNOWN_PAYEE }],
  };
}

describe('agent identity', () => {
  it('buildAgentIdentityChallengeHeader encodes challenge envelope', async () => {
    const nonceStore = createAgentIdentityNonceStore();
    const request = new Request('http://localhost:3000/api/test', { method: 'POST' });
    const header = await buildAgentIdentityChallengeHeader(request, nonceStore);
    const decoded = decodeAgentHeader(header);
    expect(decoded.v).toBe(1);
    expect(decoded.challenge.domain).toBe('localhost');
    expect(decoded.challenge.route).toBe('/api/test');
    expect(decoded.challenge.nonce).toBeTruthy();
  });

  it('probe returns X-Agent-Identity alongside payment challenge', async () => {
    const handler = createRequestHandler(makePaidEntry(), async () => ({}), makeDeps());
    const res = await handler(new Request('http://localhost:3000/api/test', { method: 'POST' }));
    expect(res.status).toBe(402);
    expect(res.headers.get(HEADERS.X402_PAYMENT_REQUIRED)).toBeTruthy();
    expect(res.headers.get(HEADERS.AGENT_IDENTITY)).toBeTruthy();
    const decoded = decodeAgentHeader(res.headers.get(HEADERS.AGENT_IDENTITY)!);
    expect(decoded.challenge.route).toBe('/api/test');
  });

  it('request without identity header leaves actor null', async () => {
    let capturedActor: string | null | undefined;
    const handler = createRequestHandler(
      makeUnprotectedEntry(),
      async (ctx) => {
        capturedActor = ctx.actor;
        return { ok: true };
      },
      makeDeps(),
    );
    const res = await handler(new Request('http://localhost:3000/api/test', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(capturedActor).toBeNull();
  });

  it('valid identity proof sets actor on handler context', async () => {
    const nonceStore = createAgentIdentityNonceStore();
    const challenge = await createChallenge(
      { domain: 'localhost', route: '/api/test' },
      { nonceStore },
    );
    const signature = await TEST_ACCOUNT.signMessage({
      message: JSON.stringify(challenge),
    });
    const proofHeader = Buffer.from(
      JSON.stringify({ v: 1, challenge, did: TEST_DID, signature }),
    ).toString('base64url');

    let capturedActor: string | null | undefined;
    const handler = createRequestHandler(
      makeUnprotectedEntry(),
      async (ctx) => {
        capturedActor = ctx.actor;
        return { ok: true };
      },
      makeDeps(nonceStore),
    );

    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { [HEADERS.AGENT_IDENTITY]: proofHeader },
    });
    const res = await handler(request);
    expect(res.status).toBe(200);
    expect(capturedActor).toBe(TEST_DID);
  });

  it('invalid identity proof returns 401', async () => {
    const nonceStore = createAgentIdentityNonceStore();
    const challenge = await createChallenge(
      { domain: 'localhost', route: '/api/test' },
      { nonceStore },
    );
    const badProof = Buffer.from(
      JSON.stringify({
        v: 1,
        challenge,
        did: TEST_DID,
        signature: '0x' + '00'.repeat(65),
      }),
    ).toString('base64url');

    const handler = createRequestHandler(
      makeUnprotectedEntry(),
      async () => ({ ok: true }),
      makeDeps(nonceStore),
    );
    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { [HEADERS.AGENT_IDENTITY]: badProof },
    });
    const res = await handler(request);
    expect(res.status).toBe(401);
  });

  it('resolveActor returns null when header is absent', async () => {
    const nonceStore = createAgentIdentityNonceStore();
    const request = new Request('http://localhost:3000/api/test');
    await expect(resolveActor(request, nonceStore)).resolves.toBeNull();
  });

  it('attachAgentIdentityChallenge sets response header', async () => {
    const nonceStore = createAgentIdentityNonceStore();
    const request = new Request('http://localhost:3000/api/test');
    const response = new Response(null, { status: 402 });
    await attachAgentIdentityChallenge(response, request, nonceStore);
    expect(response.headers.get(HEADERS.AGENT_IDENTITY)).toBeTruthy();
  });
});
