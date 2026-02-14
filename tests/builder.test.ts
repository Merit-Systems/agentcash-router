import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RouteRegistry } from '../src/registry.js';
import { RouteBuilder } from '../src/builder.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import type { OrchestrateDeps } from '../src/orchestrate.js';

function makeDeps(): OrchestrateDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    payeeAddress: '0x1234',
    network: 'eip155:8453',
  };
}

function makeBuilder(key = 'test/route', registry?: RouteRegistry) {
  const reg = registry ?? new RouteRegistry();
  return { builder: new RouteBuilder(key, reg, makeDeps()), registry: reg };
}

const bodySchema = z.object({ query: z.string() });
const querySchema = z.object({ page: z.string().optional() });
const outputSchema = z.object({ result: z.string() });

describe('fluent chain', () => {
  it('.paid().body().handler() produces a function', () => {
    const { builder } = makeBuilder();
    const handler = builder
      .paid('0.01')
      .body(bodySchema)
      .handler(async ({ body }) => ({ result: body.query }));
    expect(typeof handler).toBe('function');
  });

  it('.siwx().query().handler() produces a function', () => {
    const { builder } = makeBuilder();
    const handler = builder
      .siwx()
      .query(querySchema)
      .handler(async ({ query }) => ({ page: query.page }));
    expect(typeof handler).toBe('function');
  });

  it('.unprotected().handler() produces a function', () => {
    const { builder } = makeBuilder();
    const handler = builder.unprotected().handler(async () => ({ status: 'ok' }));
    expect(typeof handler).toBe('function');
  });

  it('.paid().body().output().description().handler() preserves all metadata in registry', () => {
    const { builder, registry } = makeBuilder('meta/test');
    builder
      .paid('0.05')
      .body(bodySchema)
      .output(outputSchema)
      .description('Test route description')
      .handler(async ({ body }) => ({ result: body.query }));

    const entry = registry.get('meta/test');
    expect(entry).toBeDefined();
    expect(entry!.pricing).toBe('0.05');
    expect(entry!.description).toBe('Test route description');
    expect(entry!.bodySchema).toBeDefined();
    expect(entry!.outputSchema).toBeDefined();
  });

  it('route key is stored in registry on construction', () => {
    const { builder, registry } = makeBuilder('stored/key');
    builder.unprotected().handler(async () => ({ ok: true }));
    expect(registry.has('stored/key')).toBe(true);
  });
});

describe('registration-time safety', () => {
  it('dynamic pricing without maxPrice throws at registration', () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid((body: unknown) => '0.01')).toThrow('maxPrice');
  });

  it('duplicate route key throws at registration', () => {
    const reg = new RouteRegistry();
    const b1 = new RouteBuilder('dup/key', reg, makeDeps());
    b1.unprotected().handler(async () => ({}));

    const b2 = new RouteBuilder('dup/key', reg, makeDeps());
    expect(() => b2.unprotected().handler(async () => ({}))).toThrow('already registered');
  });

  it('empty tier key throws at registration', () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid({ field: 'tier', tiers: { '': { price: '0.01' } } })).toThrow(
      'tier key cannot be empty',
    );
  });

  it("maxPrice '0' throws at registration", () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid((body: unknown) => '0.01', { maxPrice: '0' })).toThrow(
      'must be a positive decimal',
    );
  });

  it("maxPrice 'abc' throws at registration", () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid((body: unknown) => '0.01', { maxPrice: 'abc' })).toThrow(
      'must be a positive decimal',
    );
  });

  it('invalid tier price throws at registration', () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid({ field: 'tier', tiers: { basic: { price: 'free' } } })).toThrow(
      "tier 'basic' price 'free' must be a positive decimal",
    );
  });

  it('negative tier price throws at registration', () => {
    const { builder } = makeBuilder();
    expect(() => builder.paid({ field: 'tier', tiers: { basic: { price: '-1.00' } } })).toThrow(
      'must be a positive decimal',
    );
  });

  it('fork() does not leak protocol array mutations', () => {
    const reg = new RouteRegistry();
    const b1 = new RouteBuilder('fork/base', reg, makeDeps());
    const chain1 = b1.paid('0.01', { protocols: ['x402'] });

    // Fork again from the same base — different key needed for registration
    const reg2 = new RouteRegistry();
    const b2 = new RouteBuilder('fork/other', reg2, makeDeps());
    const chain2 = b2.paid('0.02', { protocols: ['x402', 'mpp'] });

    chain1.body(bodySchema).handler(async () => ({}));
    chain2.body(bodySchema).handler(async () => ({}));

    const e1 = reg.get('fork/base');
    const e2 = reg2.get('fork/other');
    expect(e1!.protocols).toEqual(['x402']);
    expect(e2!.protocols).toEqual(['x402', 'mpp']);
  });
});
