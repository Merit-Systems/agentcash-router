import { describe, expect, it } from 'vitest';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore, MemoryEntitlementStore } from '../src/kv-store/index.js';
import { makeTestAgentIdentityNonceStore } from './fakes/agent-identity-deps.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';
import { getRouterConfigIssues, routerConfigFromEnv } from '../src/config/index.js';
import { RouterConfigError } from '../src/config/error.js';
import { resolveResourceMetadata } from '../src/protocols/x402/resource-metadata.js';
import type { RouteEntry, RouterConfig } from '../src/types.js';

const BASE_MAINNET_NETWORK = 'eip155:8453';
const ROUTE_URL = 'http://localhost:3000/api/quote';
const BUILDER_CODE = 'bc_agentcash';

function makePaidEntry(): RouteEntry {
  return {
    key: 'quote',
    authMode: 'paid',
    pricing: '0.01',
    protocols: ['x402'],
    method: 'POST',
    billing: 'exact',
  };
}

function makeDeps(server: FakeX402Server, overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    agentIdentityNonceStore: makeTestAgentIdentityNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_MAINNET_NETWORK,
    x402Accepts: [{ scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE }],
    ...overrides,
  };
}

async function challengeFor(deps: RouterDeps) {
  const handler = createRequestHandler(makePaidEntry(), async () => ({ ok: true }), deps);
  const response = await handler(new Request(ROUTE_URL, { method: 'POST' }));
  expect(response.status).toBe(402);
  return decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
}

describe('builder-code challenge declaration', () => {
  it('declares the app code on the 402 when builderCode is configured', async () => {
    const challenge = await challengeFor(
      makeDeps(new FakeX402Server(), { builderCode: BUILDER_CODE }),
    );

    const ext = (challenge as unknown as { extensions?: Record<string, unknown> }).extensions?.[
      'builder-code'
    ] as { info?: { a?: string }; schema?: Record<string, unknown> } | undefined;
    expect(ext).toBeDefined();
    expect(ext!.info?.a).toBe(BUILDER_CODE);
    expect(ext!.schema).toBeDefined();
  });

  it('omits the extension when builderCode is not configured', async () => {
    const challenge = await challengeFor(makeDeps(new FakeX402Server()));
    const extensions = (challenge as unknown as { extensions?: Record<string, unknown> })
      .extensions;
    expect(extensions?.['builder-code']).toBeUndefined();
  });
});

describe('resource metadata on challenges', () => {
  it('merges serviceName/tags/iconUrl into PaymentRequired.resource', async () => {
    const challenge = await challengeFor(
      makeDeps(new FakeX402Server(), {
        x402ResourceMetadata: {
          serviceName: 'Quote API',
          tags: ['quotes', 'wisdom'],
          iconUrl: 'https://example.com/icon.png',
        },
      }),
    );

    const resource = (
      challenge as unknown as {
        resource: { serviceName?: string; tags?: string[]; iconUrl?: string; url: string };
      }
    ).resource;
    expect(resource.serviceName).toBe('Quote API');
    expect(resource.tags).toEqual(['quotes', 'wisdom']);
    expect(resource.iconUrl).toBe('https://example.com/icon.png');
    expect(resource.url).toBe(ROUTE_URL);
  });

  it('leaves the resource block bare when no metadata is configured', async () => {
    const challenge = await challengeFor(makeDeps(new FakeX402Server()));
    const resource = (challenge as unknown as { resource: { serviceName?: string } }).resource;
    expect(resource.serviceName).toBeUndefined();
  });
});

describe('resolveResourceMetadata', () => {
  it('explicit serviceName wins over title', () => {
    expect(resolveResourceMetadata({ title: 'My Long Title', serviceName: 'short_name' })).toEqual({
      serviceName: 'short_name',
    });
  });

  it('falls back to title when the title fits the constraint', () => {
    expect(resolveResourceMetadata({ title: 'Quote API' })).toEqual({ serviceName: 'Quote API' });
  });

  it('omits serviceName when the title violates the constraint (no truncation)', () => {
    expect(resolveResourceMetadata({ title: 'x'.repeat(33) })).toBeUndefined();
    expect(resolveResourceMetadata({ title: 'émoji ünsafe' })).toBeUndefined();
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveResourceMetadata(undefined)).toBeUndefined();
    expect(resolveResourceMetadata({})).toBeUndefined();
  });
});

describe('config validation', () => {
  const baseConfig: RouterConfig = {
    payeeAddress: KNOWN_PAYEE,
    baseUrl: 'https://api.example.com',
  };
  const env = { CDP_API_KEY_ID: 'id', CDP_API_KEY_SECRET: 'secret' };

  it('rejects a malformed builderCode', () => {
    const issues = getRouterConfigIssues(
      { ...baseConfig, x402: { builderCode: 'Bad-Code!' } },
      { env },
    );
    expect(issues.map((i) => i.code)).toContain('invalid_builder_code');
  });

  it('accepts a well-formed builderCode', () => {
    const issues = getRouterConfigIssues(
      { ...baseConfig, x402: { builderCode: BUILDER_CODE } },
      { env },
    );
    expect(issues).toEqual([]);
  });

  it('rejects invalid discovery metadata', () => {
    const issues = getRouterConfigIssues(
      {
        ...baseConfig,
        discovery: {
          title: 'T',
          version: '1.0.0',
          serviceName: 'x'.repeat(33),
          tags: ['a', 'b', 'c', 'd', 'e', 'f'],
          iconUrl: 'http://insecure.example.com/icon.png',
        },
      },
      { env },
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('invalid_discovery_service_name');
    expect(codes).toContain('invalid_discovery_tags');
    expect(codes).toContain('invalid_discovery_icon_url');
  });

  it('accepts valid discovery metadata', () => {
    const issues = getRouterConfigIssues(
      {
        ...baseConfig,
        discovery: {
          title: 'T',
          version: '1.0.0',
          serviceName: 'Quote API',
          tags: ['quotes'],
          iconUrl: 'https://example.com/icon.png',
        },
      },
      { env },
    );
    expect(issues).toEqual([]);
  });
});

describe('createRouterFromEnv wiring', () => {
  const envBase = {
    BASE_URL: 'https://api.example.com',
    EVM_PAYEE_ADDRESS: '0x1234567890123456789012345678901234567890',
  };
  const options = { title: 'Quote API', description: 'Quotes.', guidance: 'POST /quote.' };

  it('threads X402_BUILDER_CODE into x402.builderCode', () => {
    const config = routerConfigFromEnv({
      ...options,
      env: { ...envBase, X402_BUILDER_CODE: BUILDER_CODE },
    });
    expect(config.x402?.builderCode).toBe(BUILDER_CODE);
  });

  it('rejects a malformed X402_BUILDER_CODE with a structured issue', () => {
    expect(() =>
      routerConfigFromEnv({ ...options, env: { ...envBase, X402_BUILDER_CODE: 'Bad Code' } }),
    ).toThrowError(RouterConfigError);
    try {
      routerConfigFromEnv({ ...options, env: { ...envBase, X402_BUILDER_CODE: 'Bad Code' } });
    } catch (err) {
      expect((err as RouterConfigError).issues.map((i) => i.code)).toContain(
        'invalid_builder_code',
      );
    }
  });

  it('threads serviceName/tags/iconUrl options into discovery config', () => {
    const config = routerConfigFromEnv({
      ...options,
      serviceName: 'Quote API',
      tags: ['quotes'],
      iconUrl: 'https://example.com/icon.png',
      env: envBase,
    });
    expect(config.discovery.serviceName).toBe('Quote API');
    expect(config.discovery.tags).toEqual(['quotes']);
    expect(config.discovery.iconUrl).toBe('https://example.com/icon.png');
  });
});
