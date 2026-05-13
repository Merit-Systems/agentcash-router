import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RouteRegistry } from '../src/registry.js';
import { RouteBuilder } from '../src/builder.js';
import { MemoryNonceStore } from '../src/kv-store/index.js';
import { MemoryEntitlementStore } from '../src/kv-store/index.js';
import type { OrchestrateDeps } from '../src/pipeline/orchestrate.js';

function makeDeps(): OrchestrateDeps {
  return {
    x402Server: null,
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: '0x1234',
    network: 'eip155:8453',
    x402Accepts: [{ network: 'eip155:8453', payTo: '0x1234' }],
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
      .inputExample({ query: 'hello' })
      .handler(async ({ body }) => ({ result: body.query }));
    expect(typeof handler).toBe('function');
  });

  it('.siwx().query().handler() produces a function', () => {
    const { builder } = makeBuilder();
    const handler = builder
      .siwx()
      .query(querySchema)
      .inputExample({ page: '1' })
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
      .inputExample({ query: 'hello' })
      .output(outputSchema)
      .outputExample({ result: 'ok' })
      .description('Test route description')
      .handler(async ({ body }) => ({ result: body.query }));

    const entry = registry.get('meta/test');
    expect(entry).toBeDefined();
    expect(entry!.pricing).toBe('0.05');
    expect(entry!.description).toBe('Test route description');
    expect(entry!.bodySchema).toBeDefined();
    expect(entry!.outputSchema).toBeDefined();
    expect(entry!.inputExample).toEqual({ query: 'hello' });
    expect(entry!.outputExample).toEqual({ result: 'ok' });
  });

  it('.settlement() preserves route-level settlement hooks', () => {
    const { builder, registry } = makeBuilder('settlement/test');
    const beforeSettle = async () => {};
    const afterSettle = async () => {};

    builder
      .paid('0.05')
      .body(bodySchema)
      .inputExample({ query: 'hello' })
      .settlement({ beforeSettle, afterSettle })
      .handler(async ({ body }) => ({ result: body.query }));

    const entry = registry.get('settlement/test');
    expect(entry?.settlement?.beforeSettle).toBe(beforeSettle);
    expect(entry?.settlement?.afterSettle).toBe(afterSettle);
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

  it('.handler() without an auth mode throws at registration for JS callers', () => {
    const { builder } = makeBuilder('missing/auth');
    expect(() =>
      // @ts-expect-error — runtime guard for JavaScript consumers
      builder.handler(async () => ({})),
    ).toThrow('Select an auth mode');
  });

  it('rejects .unprotected() after payment or identity auth', () => {
    const { builder: paid } = makeBuilder('paid/unprotected');
    expect(() => paid.paid('0.01').unprotected()).toThrow(
      'Cannot combine .unprotected() and .paid()',
    );

    const { builder: siwx } = makeBuilder('siwx/unprotected');
    expect(() => siwx.siwx().unprotected()).toThrow('Cannot combine .unprotected() and .siwx()');

    const { builder: apiKey } = makeBuilder('apikey/unprotected');
    expect(() => apiKey.apiKey(() => ({})).unprotected()).toThrow(
      'Cannot combine .unprotected() and .apiKey()',
    );
  });

  it('rejects .paid() after .unprotected()', () => {
    const { builder } = makeBuilder('unprotected/paid');
    expect(() => builder.unprotected().paid('0.01')).toThrow(
      'Cannot combine .unprotected() and .paid()',
    );
  });

  it('rejects repeated .paid() calls on the same route', () => {
    const { builder } = makeBuilder('paid/twice');
    expect(() => builder.paid('0.01').paid('0.02')).toThrow('Cannot call .paid() more than once');
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
        .inputExample({ query: 'hello' })
        .handler(async () => ({})),
    ).not.toThrow();
  });

  it('.settlement() without .paid() throws at registration', () => {
    const { builder } = makeBuilder('settlement/not-paid');
    expect(() =>
      builder
        .unprotected()
        .settlement({ beforeSettle: async () => {} })
        .handler(async () => ({})),
    ).toThrow('.settlement() requires a paid route');
  });

  it('.settlement() works on paid routes that also require API keys', () => {
    const { builder } = makeBuilder('settlement/apikey');
    expect(() =>
      builder
        .paid('0.01')
        .apiKey(() => ({ id: 'account' }))
        .settlement({ afterSettle: async () => {} })
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

    chain1
      .body(bodySchema)
      .inputExample({ query: 'hello' })
      .handler(async () => ({}));
    chain2
      .body(bodySchema)
      .inputExample({ query: 'hello' })
      .handler(async () => ({}));

    const e1 = reg.get('fork/base');
    const e2 = reg2.get('fork/other');
    expect(e1!.protocols).toEqual(['x402']);
    expect(e2!.protocols).toEqual(['x402', 'mpp']);
  });

  it('.paid() copies protocol arrays from options', () => {
    const { builder, registry } = makeBuilder('protocols/copy');
    const protocols: Array<'x402' | 'mpp'> = ['x402'];

    builder.paid('0.01', { protocols }).handler(async () => ({}));
    protocols.push('mpp');

    expect(registry.get('protocols/copy')!.protocols).toEqual(['x402']);
  });

  it('.body() and .query() allow omitted examples', () => {
    const { builder: bodyBuilder, registry: bodyRegistry } = makeBuilder('no/input-example');
    expect(() =>
      bodyBuilder
        .paid('0.01')
        .body(bodySchema)
        .handler(async () => ({})),
    ).not.toThrow();
    expect(bodyRegistry.get('no/input-example')!.inputExample).toBeUndefined();

    const { builder: queryBuilder, registry: queryRegistry } = makeBuilder('no/query-example');
    expect(() =>
      queryBuilder
        .siwx()
        .query(querySchema)
        .handler(async () => ({})),
    ).not.toThrow();
    expect(queryRegistry.get('no/query-example')!.inputExample).toBeUndefined();
  });

  it('.output() allows omitted examples', () => {
    const { builder, registry } = makeBuilder('no/output-example');
    expect(() =>
      builder
        .paid('0.01')
        .body(bodySchema)
        .output(outputSchema)
        .handler(async () => ({})),
    ).not.toThrow();
    expect(registry.get('no/output-example')!.outputExample).toBeUndefined();
  });

  it('.inputExample() requires a request schema for JavaScript callers', () => {
    const { builder } = makeBuilder('example/no-input-schema');
    expect(() =>
      builder
        .unprotected()
        // @ts-expect-error — runtime guard for JavaScript consumers
        .inputExample({ query: 'hello' })
        .handler(async () => ({})),
    ).toThrow('.inputExample() requires .body() or .query()');
  });

  it('.outputExample() requires an output schema for JavaScript callers', () => {
    const { builder } = makeBuilder('example/no-output-schema');
    expect(() =>
      builder
        .unprotected()
        // @ts-expect-error — runtime guard for JavaScript consumers
        .outputExample({ result: 'ok' })
        .handler(async () => ({})),
    ).toThrow('.outputExample() requires .output()');
  });

  it('.inputExample() that does not match .body() schema throws at registration', () => {
    const { builder } = makeBuilder('bad/input-example');
    expect(() =>
      builder
        .paid('0.01')
        .body(bodySchema)
        // @ts-expect-error — wrong type, testing runtime validation
        .inputExample({ query: 123 })
        .handler(async () => ({})),
    ).toThrow('.inputExample() does not satisfy .body() schema');
  });

  it('.outputExample() that does not match .output() schema throws at registration', () => {
    const { builder } = makeBuilder('bad/output-example');
    expect(() =>
      builder
        .paid('0.01')
        .body(bodySchema)
        .inputExample({ query: 'hello' })
        .output(outputSchema)
        // @ts-expect-error — wrong type, testing runtime validation
        .outputExample({ result: 123 })
        .handler(async () => ({})),
    ).toThrow('.outputExample() does not satisfy .output() schema');
  });

  it('.outputExample() accepts a top-level array (e.g. z.array(...))', () => {
    const { builder, registry } = makeBuilder('array/output');
    const arraySchema = z.array(z.record(z.string(), z.unknown()));
    builder
      .paid('0.01')
      .output(arraySchema)
      .outputExample([{ name: 'Ethereum' }, { name: 'Base' }])
      .handler(async () => []);

    const entry = registry.get('array/output');
    expect(entry!.outputExample).toEqual([{ name: 'Ethereum' }, { name: 'Base' }]);
  });

  it('.outputExample() rejects an array that does not match the schema', () => {
    const { builder } = makeBuilder('bad/array-output');
    const arraySchema = z.array(z.object({ name: z.string() }));
    expect(() =>
      builder
        .paid('0.01')
        .output(arraySchema)
        // @ts-expect-error — wrong element type, testing runtime validation
        .outputExample([{ name: 123 }])
        .handler(async () => []),
    ).toThrow('.outputExample() does not satisfy .output() schema');
  });
});
