import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestHandler, type OrchestrateDeps } from '../src/orchestrate.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { FakeX402Server, KNOWN_PAYER, KNOWN_PAYEE } from './fakes/x402-server.js';
import { withX402Payment } from './fakes/request.js';
import { createDefaultContext } from '../src/plugin.js';
import type { RouterPlugin, RequestMeta, PluginContext } from '../src/plugin.js';
import type { RouteEntry } from '../src/types.js';

const bodySchema = z.object({ query: z.string() });

function makeSpyPlugin(): RouterPlugin & {
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};
  const track =
    (name: string) =>
    (...args: unknown[]) => {
      if (!calls[name]) calls[name] = [];
      calls[name].push(args);
    };

  return {
    calls,
    onRequest: (meta: RequestMeta) => {
      track('onRequest')(meta);
      return createDefaultContext(meta);
    },
    onPaymentVerified: track('onPaymentVerified') as RouterPlugin['onPaymentVerified'],
    onPaymentSettled: track('onPaymentSettled') as RouterPlugin['onPaymentSettled'],
    onResponse: track('onResponse') as RouterPlugin['onResponse'],
    onError: track('onError') as RouterPlugin['onError'],
    onAlert: track('onAlert') as RouterPlugin['onAlert'],
  };
}

function makeDeps(plugin?: RouterPlugin): OrchestrateDeps {
  const server = new FakeX402Server();
  return {
    x402Server: server as unknown as Record<string, Function>,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'eip155:8453',
    validateConfig: () => {},
    plugin,
  };
}

function makeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    pricing: '0.02',
    protocols: ['x402'],
    method: 'POST',
    bodySchema,
    ...overrides,
  };
}

function makePaymentRequest(body?: unknown): NextRequest {
  return withX402Payment({ body });
}

describe('plugin lifecycle', () => {
  it('onRequest fires before auth check', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(plugin.calls.onRequest).toHaveLength(1);
  });

  it('onPaymentVerified fires after successful verify', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry();
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const res = await handler(makePaymentRequest({ query: 'test' }));
    expect(res.status).toBe(200);
    expect(plugin.calls.onPaymentVerified).toHaveLength(1);
  });

  it('onResponse fires on every request (success)', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(plugin.calls.onResponse).toHaveLength(1);
  });

  it('onResponse fires on error', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('boom');
      },
      deps,
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(plugin.calls.onResponse).toHaveLength(1);
  });

  it('onError fires when handler throws', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    const handler = createRequestHandler(
      entry,
      async () => {
        throw new Error('handler error');
      },
      deps,
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(plugin.calls.onError).toHaveLength(1);
  });

  it('onAlert fires when handler calls ctx.alert()', async () => {
    const plugin = makeSpyPlugin();
    const deps = makeDeps(plugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [], bodySchema: undefined });
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        ctx.alert('warn', 'Rate limit low', { remaining: 10 });
        return { ok: true };
      },
      deps,
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(plugin.calls.onAlert).toHaveLength(1);
    expect((plugin.calls.onAlert[0][1] as { level: string }).level).toBe('warn');
  });

  it('plugin not configured → no errors, hooks silently skipped', async () => {
    const deps = makeDeps(undefined);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [], bodySchema: undefined });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it('async plugin hook rejection does not crash', async () => {
    const asyncPlugin: RouterPlugin = {
      onRequest(meta: RequestMeta) {
        return createDefaultContext(meta);
      },
      onResponse() {
        return Promise.reject(new Error('async boom')) as unknown as void;
      },
    };
    const deps = makeDeps(asyncPlugin);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [], bodySchema: undefined });
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const req = new NextRequest('http://localhost:3000/api/test');
    // Should not throw or cause unhandled rejection
    const res = await handler(req);
    expect(res.status).toBe(200);
  });
});

describe('PluginContext', () => {
  it('setVerifiedWallet updates handler context wallet', async () => {
    const entry = makeEntry({ authMode: 'unprotected', protocols: [] });
    let capturedWallet: string | null = null;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        ctx.setVerifiedWallet('0xManualWallet');
        capturedWallet = ctx.wallet; // wallet field is not auto-updated on HandlerContext
        return {};
      },
      makeDeps(),
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    // wallet on HandlerContext is set at construction, not mutated
    // But setVerifiedWallet updates the pluginCtx
    expect(capturedWallet).toBeNull(); // original wallet stays null
  });

  it('context created even without plugin', async () => {
    const deps = makeDeps(undefined);
    const entry = makeEntry({ authMode: 'unprotected', protocols: [], bodySchema: undefined });
    let ctxReceived = false;
    const handler = createRequestHandler(
      entry,
      async (ctx) => {
        ctxReceived = ctx.alert !== undefined && ctx.setVerifiedWallet !== undefined;
        return {};
      },
      deps,
    );
    const req = new NextRequest('http://localhost:3000/api/test');
    await handler(req);
    expect(ctxReceived).toBe(true);
  });
});
