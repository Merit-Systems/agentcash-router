import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { RouteRegistry } from '../src/registry.js';
import { createWellKnownHandler } from '../src/discovery/well-known.js';
import { createLlmsTxtHandler } from '../src/discovery/llms-txt.js';
import type { RouteEntry } from '../src/types.js';

function makeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    billing: 'exact',
    protocols: ['x402'],
    method: 'POST',
    pricing: '0.02',
    ...overrides,
  };
}

const dummyRequest = new Request('http://localhost:3000/.well-known/x402');
const defaultDiscovery = { title: 'Test', version: '1.0.0' };

describe('.well-known/x402', () => {
  it('lists all routes with x402 in protocols', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'search' }));
    reg.register(makeEntry({ key: 'lookup' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.version).toBe(1);
    expect(body.resources).toContain('https://example.com/api/search');
    expect(body.resources).toContain('https://example.com/api/lookup');
  });

  it('includes SIWX routes and excludes unprotected routes', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'paid-route', protocols: ['x402'] }));
    reg.register(makeEntry({ key: 'siwx-route', authMode: 'siwx', protocols: [] }));
    reg.register(makeEntry({ key: 'free-route', authMode: 'unprotected', protocols: [] }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources).toHaveLength(2);
    expect(body.resources).toContain('https://example.com/api/paid-route');
    expect(body.resources).toContain('https://example.com/api/siwx-route');
  });

  it('includes instructions when provided', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, {
      title: 'Test',
      version: '1.0.0',
      guidance: 'Test instructions',
    });
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.instructions).toBe('Test instructions');
  });

  it('includes ownership proofs', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, {
      ...defaultDiscovery,
      ownershipProofs: ['0xabc'],
    });
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.ownershipProofs).toEqual(['0xabc']);
  });

  it('includes MPP resources when routes declare mpp', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'dual', protocols: ['x402', 'mpp'] }));
    reg.register(makeEntry({ key: 'x402only', protocols: ['x402'] }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources).toHaveLength(2);
    expect(body.mppResources).toHaveLength(1);
    expect(body.mppResources[0]).toContain('dual');
  });

  it('strips trailing slash from baseUrl to avoid double-slash URLs', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'upload', protocols: ['x402', 'mpp'] }));

    const handler = createWellKnownHandler(
      reg,
      'https://stableupload.dev/',
      undefined,
      defaultDiscovery,
    );
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources[0]).toBe('https://stableupload.dev/api/upload');
    expect(body.mppResources[0]).toBe('https://stableupload.dev/api/upload');
  });

  it('deduplicates URLs from routes sharing the same path', async () => {
    const reg = new RouteRegistry();
    reg.register(
      makeEntry({ key: 'jobs/status', path: 'x402/jobs/{jobId}', authMode: 'siwx', protocols: [] }),
    );
    reg.register(
      makeEntry({ key: 'jobs/delete', path: 'x402/jobs/{jobId}', authMode: 'siwx', protocols: [] }),
    );

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources).toHaveLength(1);
    expect(body.resources[0]).toBe('https://example.com/api/x402/jobs/{jobId}');
  });

  it('includes description when provided', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, {
      ...defaultDiscovery,
      description: 'Test service',
    });
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.description).toBe('Test service');
  });

  it('sets CORS headers', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('no mppResources when no routes declare mpp', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a', protocols: ['x402'] }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.mppResources).toBeUndefined();
  });

  it('emits method-prefixed resources for non-default methods by default', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'jobs/delete', path: 'jobs/{id}', method: 'DELETE' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, defaultDiscovery);
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources).toContain('DELETE https://example.com/api/jobs/{id}');
  });

  it('can disable method hints', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'jobs/delete', path: 'jobs/{id}', method: 'DELETE' }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, {
      ...defaultDiscovery,
      methodHints: 'off',
    });
    const res = await handler(dummyRequest);
    const body = await res.json();

    expect(body.resources).toContain('https://example.com/api/jobs/{id}');
    expect(body.resources).not.toContain('DELETE https://example.com/api/jobs/{id}');
  });
});

describe('barrel validation', () => {
  it('throws naming the missing route key', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'registered' }));

    const handler = createWellKnownHandler(
      reg,
      'https://example.com',
      ['registered', 'missing-route'],
      defaultDiscovery,
    );

    await expect(handler(dummyRequest)).rejects.toThrow('missing-route');
  });
});

describe('.docs() containment', () => {
  const DOCS_TEXT = 'LONG-FORM OPERATION DOCS: model quirks, retry advice, judgment calls.';

  it('never reaches well-known output', async () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'documented', description: 'Short summary', docs: DOCS_TEXT }));

    const handler = createWellKnownHandler(reg, 'https://example.com', undefined, {
      ...defaultDiscovery,
      guidance: 'Raw guidance',
    });
    const res = await handler(dummyRequest);
    const text = JSON.stringify(await res.json());

    expect(text).not.toContain(DOCS_TEXT);
    expect(text).toContain('Raw guidance');
  });

  it('never reaches llms.txt output', async () => {
    const reg = new RouteRegistry();
    reg.register(
      makeEntry({
        key: 'documented',
        description: 'Short summary',
        docs: DOCS_TEXT,
        nextSteps: [{ route: 'target' }],
      }),
    );
    reg.register(makeEntry({ key: 'target', docs: DOCS_TEXT }));

    const handler = createLlmsTxtHandler(
      { ...defaultDiscovery, guidance: 'Raw guidance' },
      reg,
      'https://example.com',
    );
    const text = await (await handler(dummyRequest)).text();

    expect(text).toContain('## Workflows');
    expect(text).not.toContain(DOCS_TEXT);
  });
});

describe('composed guidance budget warning', () => {
  // agentcash auto-includes guidance in discover only when the COMPOSED
  // output (authored guidance + the `## Workflows` section) is ≤ 1000 tokens
  // (= 4000 chars). The warning lives behind a module-level once-per-process
  // flag, so each test reloads the module to get a fresh flag.
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  async function freshCompose() {
    const mod = await import('../src/discovery/utils/workflows.js');
    return mod.composeGuidanceWithWorkflows;
  }

  function chainedRegistry(): RouteRegistry {
    const reg = new RouteRegistry();
    reg.register(
      makeEntry({
        key: 'start',
        description: 'Start the run',
        nextSteps: [{ route: 'target', note: 'Poll until done' }],
      }),
    );
    reg.register(makeEntry({ key: 'target', description: 'Run status' }));
    return reg;
  }

  it('does not warn when the composed guidance is within budget', async () => {
    const compose = await freshCompose();
    // Exactly at the 4000-char boundary (≤ budget) — no warning.
    const composed = await compose(
      { ...defaultDiscovery, guidance: 'g'.repeat(4000) },
      undefined,
      'https://example.com',
      'api',
    );
    expect(composed).toHaveLength(4000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when authored guidance + the Workflows section cross the budget together', async () => {
    const compose = await freshCompose();
    // Authored guidance alone is under budget; the auto-generated
    // `## Workflows` section pushes the COMPOSED output over 4000 chars.
    const authored = 'g'.repeat(3980);
    const composed = await compose(
      { ...defaultDiscovery, guidance: authored },
      chainedRegistry(),
      'https://example.com',
      'api',
    );

    expect(authored.length).toBeLessThanOrEqual(4000);
    expect(composed).toContain('## Workflows');
    expect(composed!.length).toBeGreaterThan(4000);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toBe(
      `[router] composed guidance is ~${Math.ceil(composed!.length / 4)} tokens; ` +
        `>1000 tokens means agentcash withholds it from discover by default — ` +
        `trim authored guidance or reduce chain notes`,
    );
  });

  it('fires once per process, not per request', async () => {
    const compose = await freshCompose();
    const discovery = { ...defaultDiscovery, guidance: 'g'.repeat(5000) };

    await compose(discovery, chainedRegistry(), 'https://example.com', 'api');
    await compose(discovery, chainedRegistry(), 'https://example.com', 'api');
    await compose(discovery, undefined, 'https://example.com', 'api');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
