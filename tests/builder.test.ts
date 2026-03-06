import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { RouteRegistry } from '../src/registry.js';
import { RouteBuilder } from '../src/builder.js';
import { MemoryNonceStore } from '../src/auth/nonce.js';
import { MemoryEntitlementStore } from '../src/auth/entitlement.js';
import type { OrchestrateDeps } from '../src/orchestrate.js';

function makeDeps(): OrchestrateDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
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

  it('.paid().siwx().handler() enables SIWX acceleration on paid routes', () => {
    const { builder, registry } = makeBuilder('paid/siwx');
    const handler = builder
      .paid('0.01')
      .siwx()
      .handler(async () => ({ ok: true }));

    expect(typeof handler).toBe('function');
    const entry = registry.get('paid/siwx');
    expect(entry?.authMode).toBe('paid');
    expect(entry?.siwxEnabled).toBe(true);
    expect(entry?.protocols).toEqual(['x402']);
  });
});

describe('registration-time safety', () => {
  it('dynamic pricing without maxPrice is allowed (trust mode)', () => {
    const { builder } = makeBuilder();
    // maxPrice is now optional for dynamic pricing (v0.3.1+)
    expect(() => builder.paid((body: unknown) => '0.01')).not.toThrow();
  });

  it('duplicate route key overwrites silently', () => {
    const reg = new RouteRegistry();
    const b1 = new RouteBuilder('dup/key', reg, makeDeps());
    b1.description('first')
      .unprotected()
      .handler(async () => ({}));

    const b2 = new RouteBuilder('dup/key', reg, makeDeps());
    b2.description('second')
      .unprotected()
      .handler(async () => ({}));
    expect(reg.get('dup/key')!.description).toBe('second');
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

  it('.validate() without .body() throws at registration', () => {
    const { builder } = makeBuilder();
    expect(() =>
      builder
        .paid('0.01')
        .validate(() => {})
        .handler(async () => ({})),
    ).toThrow('.validate() requires .body()');
  });

  it('.validate() with .body() does not throw', () => {
    const { builder } = makeBuilder();
    expect(() =>
      builder
        .paid('0.01')
        .validate(() => {})
        .body(bodySchema)
        .handler(async () => ({})),
    ).not.toThrow();
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

describe('schema warnings', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const clean = z.object({ name: z.string(), count: z.number(), flag: z.boolean() });

  it('no warning for plain object schemas', () => {
    const { builder } = makeBuilder();
    builder.unprotected().body(clean).handler(async () => ({}));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('no warning for optional fields inside object', () => {
    const { builder } = makeBuilder();
    builder.unprotected().body(z.object({ x: z.string().optional() })).handler(async () => ({}));
    expect(console.warn).not.toHaveBeenCalled();
  });

  const forbidden = [
    { label: 'union', name: 'union', schema: z.union([z.string(), z.number()]) },
    { label: 'discriminatedUnion', name: 'union', schema: z.discriminatedUnion('type', [z.object({ type: z.literal('a') }), z.object({ type: z.literal('b') })]) },
    { label: 'nullable', name: 'nullable', schema: z.string().nullable() },
    { label: 'intersection', name: 'intersection', schema: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })) },
  ];

  for (const { label, name, schema } of forbidden) {
    it(`warns for ${label} in .body()`, () => {
      const { builder } = makeBuilder();
      builder.unprotected().body(schema as never).handler(async () => ({}));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(name));
    });
  }

  it('warns for forbidden type nested inside object in .output()', () => {
    const { builder } = makeBuilder();
    builder.unprotected().output(z.object({ val: z.string().nullable() })).handler(async () => ({}));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('nullable'));
  });
});
