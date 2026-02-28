import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { withX402Payment } from './fakes/request.js';
import { createDefaultContext } from '../src/plugin.js';
import type { RouterPlugin, RequestMeta, PluginContext } from '../src/plugin.js';
import type { RouteEntry, ProviderQuotaEvent } from '../src/types.js';
import { RouteRegistry } from '../src/registry.js';
import { RouteBuilder } from '../src/builder.js';

const bodySchema = z.object({ query: z.string() });

function makeSpyPlugin(): RouterPlugin & {
  quotaEvents: ProviderQuotaEvent[];
} {
  const quotaEvents: ProviderQuotaEvent[] = [];

  return {
    quotaEvents,
    onRequest(meta: RequestMeta) {
      return createDefaultContext(meta);
    },
    onProviderQuota(_ctx, event) {
      quotaEvents.push(event);
    },
  };
}

function makeDeps(plugin?: RouterPlugin): OrchestrateDeps {
  const server = new FakeX402Server();
  return {
    x402Server: server as unknown as Record<string, Function>,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'eip155:8453',
    plugin,
  };
}

function makePaymentRequest(body?: unknown): NextRequest {
  return withX402Payment({ body });
}

describe('provider quota extraction', () => {
  it('extractQuota is called with handler result on success', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const extractSpy = vi.fn().mockReturnValue({ remaining: 500, limit: 1000 });

    const entry: RouteEntry = {
      key: 'provider/test',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'test-api',
      providerConfig: {
        extractQuota: extractSpy,
        warn: 100,
        critical: 10,
      },
    };

    const handler = createRequestHandler(
      entry,
      async () => ({ data: 'hello', rateLimit: { remaining: 500 } }),
      deps,
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(extractSpy).toHaveBeenCalledTimes(1);
    // First arg is the handler result
    expect(extractSpy.mock.calls[0][0]).toEqual({
      data: 'hello',
      rateLimit: { remaining: 500 },
    });
    // Second arg is response headers
    expect(extractSpy.mock.calls[0][1]).toBeInstanceOf(Headers);
  });

  it('fires onProviderQuota with "healthy" level when remaining > warn', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/healthy',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'exa',
      providerConfig: {
        extractQuota: () => ({ remaining: 500, limit: 1000 }),
        warn: 100,
        critical: 10,
      },
    };

    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents).toHaveLength(1);
    expect(plugin.quotaEvents[0].level).toBe('healthy');
    expect(plugin.quotaEvents[0].provider).toBe('exa');
    expect(plugin.quotaEvents[0].remaining).toBe(500);
  });

  it('fires "warn" level when remaining <= warn threshold', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/warn',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'apollo',
      providerConfig: {
        extractQuota: () => ({ remaining: 50, limit: 1000 }),
        warn: 100,
        critical: 10,
      },
    };

    const handler = createRequestHandler(entry, async () => ({}), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents[0].level).toBe('warn');
  });

  it('fires "critical" level when remaining <= critical threshold', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/critical',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'firecrawl',
      providerConfig: {
        extractQuota: () => ({ remaining: 5, limit: 500 }),
        warn: 100,
        critical: 10,
      },
    };

    const handler = createRequestHandler(entry, async () => ({}), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents[0].level).toBe('critical');
    expect(plugin.quotaEvents[0].overage).toBe('same-rate');
  });

  it('respects explicit overage policy', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/hardstop',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'whitepages',
      providerConfig: {
        extractQuota: () => ({ remaining: 0, limit: 100 }),
        overage: 'hard-stop',
        critical: 5,
      },
    };

    const handler = createRequestHandler(entry, async () => ({}), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents[0].overage).toBe('hard-stop');
    expect(plugin.quotaEvents[0].level).toBe('critical');
  });

  it('skips quota extraction on handler error (status >= 400)', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const extractSpy = vi.fn();

    const entry: RouteEntry = {
      key: 'quota/error',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'test',
      providerConfig: { extractQuota: extractSpy },
    };

    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('boom');
      },
      deps,
    );
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(extractSpy).not.toHaveBeenCalled();
    expect(plugin.quotaEvents).toHaveLength(0);
  });

  it('skips when extractQuota returns null', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/null',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'test',
      providerConfig: {
        extractQuota: () => null,
        warn: 100,
      },
    };

    const handler = createRequestHandler(entry, async () => ({}), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents).toHaveLength(0);
  });

  it('handles extractQuota throwing without crashing', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/throws',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'broken',
      providerConfig: {
        extractQuota: () => {
          throw new Error('extraction failed');
        },
      },
    };

    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const res = await handler(new NextRequest('http://localhost:3000/api/test'));

    // Request still succeeds despite extraction failure
    expect(res.status).toBe(200);
    expect(plugin.quotaEvents).toHaveLength(0);
  });

  it('fires quota on paid x402 routes after settlement', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'paid/quota',
      authMode: 'paid',
      pricing: '0.02',
      protocols: ['x402'],
      method: 'POST',
      bodySchema,
      providerName: 'exa',
      providerConfig: {
        extractQuota: () => ({ remaining: 200, limit: 500 }),
        warn: 100,
      },
    };

    const handler = createRequestHandler(
      entry,
      async ({ body }) => ({ result: (body as { query: string }).query }),
      deps,
    );
    const res = await handler(makePaymentRequest({ query: 'test' }));

    expect(res.status).toBe(200);
    expect(plugin.quotaEvents).toHaveLength(1);
    expect(plugin.quotaEvents[0].provider).toBe('exa');
    expect(plugin.quotaEvents[0].level).toBe('healthy');
  });

  it('remaining null → healthy level (no threshold comparison possible)', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);

    const entry: RouteEntry = {
      key: 'quota/nullremaining',
      authMode: 'unprotected',
      protocols: [],
      method: 'POST',
      providerName: 'opaque-api',
      providerConfig: {
        extractQuota: () => ({ remaining: null, limit: null }),
        warn: 100,
        critical: 10,
      },
    };

    const handler = createRequestHandler(entry, async () => ({}), deps);
    await handler(new NextRequest('http://localhost:3000/api/test'));

    expect(plugin.quotaEvents[0].level).toBe('healthy');
  });
});

describe('.provider() builder method', () => {
  function makeBuilderDeps(): OrchestrateDeps {
    return {
      x402Server: null,
      initPromise: Promise.resolve(),
      nonceStore: new MemoryNonceStore(),
      entitlementStore: new MemoryEntitlementStore(),
      payeeAddress: '0x1234',
      network: 'eip155:8453',
    };
  }

  it('stores provider config in registry entry', () => {
    const registry = new RouteRegistry();
    const builder = new RouteBuilder('provider/test', registry, makeBuilderDeps());
    const monitor = async () => ({ remaining: 100, limit: 500 });

    builder
      .unprotected()
      .provider('exa', {
        extractQuota: () => ({ remaining: 100, limit: 500 }),
        monitor,
        overage: 'hard-stop',
        warn: 50,
        critical: 5,
      })
      .handler(async () => ({}));

    const entry = registry.get('provider/test');
    expect(entry?.providerName).toBe('exa');
    expect(entry?.providerConfig?.overage).toBe('hard-stop');
    expect(entry?.providerConfig?.warn).toBe(50);
    expect(entry?.providerConfig?.critical).toBe(5);
    expect(entry?.providerConfig?.monitor).toBe(monitor);
  });

  it('works without config (name-only)', () => {
    const registry = new RouteRegistry();
    const builder = new RouteBuilder('provider/nameonly', registry, makeBuilderDeps());

    builder
      .unprotected()
      .provider('simple-api')
      .handler(async () => ({}));

    const entry = registry.get('provider/nameonly');
    expect(entry?.providerName).toBe('simple-api');
    expect(entry?.providerConfig).toEqual({});
  });

  it('chains with .paid().body()', () => {
    const registry = new RouteRegistry();
    const builder = new RouteBuilder('paid/provider', registry, makeBuilderDeps());

    const fn = builder
      .paid('0.01')
      .provider('exa', {
        extractQuota: () => ({ remaining: 100, limit: null }),
      })
      .body(bodySchema)
      .handler(async ({ body }) => ({ result: body.query }));

    expect(typeof fn).toBe('function');
    expect(registry.get('paid/provider')?.providerName).toBe('exa');
  });
});
