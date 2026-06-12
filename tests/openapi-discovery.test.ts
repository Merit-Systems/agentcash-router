import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../src/registry.js';
import { createOpenAPIHandler } from '../src/discovery/openapi.js';
import { TEMPO_USDC_ADDRESS } from '../src/index.js';
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

const request = new Request('http://localhost:3000/openapi.json');

describe('openapi discovery document', () => {
  it('emits paid route with x-payment-info + 402 and no auth security', async () => {
    const registry = new RouteRegistry();
    registry.register(
      makeEntry({
        key: 'search',
        path: 'search',
        method: 'POST',
        pricing: '0.02',
        protocols: ['x402', 'mpp'],
      }),
    );

    const handler = createOpenAPIHandler(registry, 'https://example.com', undefined, {
      title: 'Example API',
      version: '1.0.0',
    });

    const response = await handler(request);
    const doc = (await response.json()) as Record<string, any>;

    const operation = doc.paths['/api/search'].post;
    expect(operation['x-payment-info']).toEqual({
      price: { mode: 'fixed', currency: 'USD', amount: '0.02' },
      protocols: [
        { x402: {} },
        {
          mpp: {
            method: 'tempo',
            intent: 'charge',
            currency: TEMPO_USDC_ADDRESS,
          },
        },
      ],
    });
    expect(operation.responses['402']).toBeDefined();
    expect(operation.security).toBeUndefined();
  });

  it('emits SIWX and API key security schemes and operation security requirements', async () => {
    const registry = new RouteRegistry();
    registry.register(
      makeEntry({
        key: 'wallet/profile',
        path: 'wallet/profile',
        method: 'GET',
        authMode: 'siwx',
        pricing: undefined,
        protocols: [],
      }),
    );
    registry.register(
      makeEntry({
        key: 'premium/data',
        path: 'premium/data',
        method: 'POST',
        authMode: 'paid',
        siwxEnabled: true,
        pricing: '0.10',
      }),
    );
    registry.register(
      makeEntry({
        key: 'apikey/data',
        path: 'apikey/data',
        method: 'POST',
        authMode: 'paid',
        pricing: '0.10',
        apiKeyResolver: (key: string) => (key === 'valid' ? { id: 'account-1' } : null),
      }),
    );

    const handler = createOpenAPIHandler(registry, 'https://example.com', undefined, {
      title: 'Example API',
      version: '1.0.0',
    });

    const response = await handler(request);
    const doc = (await response.json()) as Record<string, any>;

    expect(doc.components.securitySchemes.siwx).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'SIGN-IN-WITH-X',
    });
    expect(doc.components.securitySchemes.apiKey).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    });

    const siwxOperation = doc.paths['/api/wallet/profile'].get;
    expect(siwxOperation.security).toEqual([{ siwx: [] }]);
    expect(siwxOperation.responses['402']).toBeDefined();

    const siwxPaidOperation = doc.paths['/api/premium/data'].post;
    expect(siwxPaidOperation.security).toEqual([{ siwx: [] }]);
    expect(siwxPaidOperation.responses['402']).toBeDefined();
    expect(siwxPaidOperation['x-payment-info']).toEqual({
      price: { mode: 'fixed', currency: 'USD', amount: '0.10' },
      protocols: [{ x402: {} }],
    });

    const apiKeyPaidOperation = doc.paths['/api/apikey/data'].post;
    expect(apiKeyPaidOperation.security).toEqual([{ apiKey: [] }]);
    expect(apiKeyPaidOperation.responses['401']).toBeDefined();
    expect(apiKeyPaidOperation.responses['402']).toBeDefined();
    expect(apiKeyPaidOperation['x-payment-info']).toEqual({
      price: { mode: 'fixed', currency: 'USD', amount: '0.10' },
      protocols: [{ x402: {} }],
    });
  });

  it('emits `security: []` for unprotected routes so discovery sees them as public', async () => {
    // Pairs with @agentcash/discovery's recognition of `security: []` as the
    // OpenAPI-native unprotected override. Without this, unprotected routes emit
    // no `security` field at all and discovery flags them as L2_AUTH_MODE_MISSING.
    const registry = new RouteRegistry();
    registry.register(
      makeEntry({
        key: 'health',
        path: 'health',
        method: 'GET',
        authMode: 'unprotected',
        pricing: undefined,
        protocols: [],
      }),
    );

    const handler = createOpenAPIHandler(registry, 'https://example.com', undefined, {
      title: 'Example API',
      version: '1.0.0',
    });

    const response = await handler(request);
    const doc = (await response.json()) as Record<string, any>;

    const operation = doc.paths['/api/health'].get;
    expect(operation.security).toEqual([]);
    expect(operation['x-payment-info']).toBeUndefined();
    expect(operation.responses['402']).toBeUndefined();
    expect(operation.responses['401']).toBeUndefined();
  });

  it('emits x-discovery metadata and quote pricing for dynamic routes', async () => {
    const registry = new RouteRegistry();
    registry.register(
      makeEntry({
        key: 'dynamic/quote',
        path: 'dynamic/quote',
        method: 'POST',
        authMode: 'paid',
        pricing: ((body: unknown) =>
          body && typeof body === 'object' ? '0.08' : '0.05') as RouteEntry['pricing'],
        minPrice: '0.01',
        maxPrice: '0.25',
      }),
    );

    const handler = createOpenAPIHandler(registry, 'https://example.com', undefined, {
      title: 'Example API',
      version: '1.0.0',
      ownershipProofs: ['did:example:proof'],
    });

    const response = await handler(request);
    const doc = (await response.json()) as Record<string, any>;

    expect(doc['x-discovery']).toEqual({
      ownershipProofs: ['did:example:proof'],
    });

    const operation = doc.paths['/api/dynamic/quote'].post;
    expect(operation['x-payment-info']).toEqual({
      price: { mode: 'dynamic', currency: 'USD', min: '0.01', max: '0.25' },
      protocols: [{ x402: {} }],
    });
  });
});
