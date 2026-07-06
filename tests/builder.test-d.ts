// Type-level tests for the RouteBuilder's compile-time invariants.
// This file is typechecked by vitest's typecheck runner (see vitest.config.ts),
// never executed — each `@ts-expect-error` line FAILS the suite if the
// combination below it stops being a compile error, so the builder's
// mutual-exclusion rules can't silently regress to runtime-only checks.
// Every rejection here mirrors a registration-time throw in src/builder.ts.
import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { RouteBuilder } from '../src/builder.js';
import type { RouteRegistry } from '../src/registry.js';
import type { RouterDeps } from '../src/pipeline/orchestrate.js';

declare const registry: RouteRegistry;
declare const deps: RouterDeps;

function make() {
  return new RouteBuilder('type/test', registry, deps);
}

describe('auth mode is required before .handler()', () => {
  it('rejects .handler() with no auth mode', () => {
    // @ts-expect-error — pick an auth mode first
    make().handler(async () => ({}));
  });

  it('rejects .body().handler() with no auth mode', () => {
    make()
      .body(z.object({ q: z.string() }))
      // @ts-expect-error — .body() alone does not select an auth mode
      .handler(async () => ({}));
  });
});

describe('pricing modes are mutually exclusive', () => {
  it('rejects a second .paid()', () => {
    // @ts-expect-error — one pricing mode per route
    make().paid('0.01').paid('0.02');
  });

  it('rejects .upTo() after .paid()', () => {
    // @ts-expect-error — one pricing mode per route
    make().paid('0.01').upTo('0.05');
  });

  it('rejects .metered() after .upTo()', () => {
    // @ts-expect-error — one pricing mode per route
    make().upTo('0.05').metered({ tickCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects .paid() after .metered()', () => {
    // @ts-expect-error — one pricing mode per route
    make().metered({ tickCost: '0.001', maxPrice: '0.05' }).paid('0.01');
  });
});

describe('.unprotected() excludes every other mode', () => {
  it('rejects pricing after .unprotected()', () => {
    // @ts-expect-error — unprotected routes cannot charge
    make().unprotected().paid('0.01');
    // @ts-expect-error — unprotected routes cannot charge
    make().unprotected().upTo('0.05');
    // @ts-expect-error — unprotected routes cannot charge
    make().unprotected().metered({ tickCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects identity after .unprotected()', () => {
    // @ts-expect-error — unprotected excludes .siwx()
    make().unprotected().siwx();
    // @ts-expect-error — unprotected excludes .apiKey()
    make()
      .unprotected()
      .apiKey(() => ({}));
  });

  it('rejects .unprotected() after any auth mode', () => {
    // @ts-expect-error — pricing excludes .unprotected()
    make().paid('0.01').unprotected();
    // @ts-expect-error — .siwx() excludes .unprotected()
    make().siwx().unprotected();
    // @ts-expect-error — .apiKey() excludes .unprotected()
    make()
      .apiKey(() => ({}))
      .unprotected();
  });
});

describe('.siwx() and .apiKey() are mutually exclusive', () => {
  it('rejects .apiKey() after .siwx()', () => {
    // @ts-expect-error — not supported on the same route
    make()
      .siwx()
      .apiKey(() => ({}));
  });

  it('rejects .siwx() after .apiKey()', () => {
    // @ts-expect-error — not supported on the same route
    make()
      .apiKey(() => ({}))
      .siwx();
  });
});

describe('.metered() and .siwx() are mutually exclusive', () => {
  it('rejects .metered() after .siwx()', () => {
    // @ts-expect-error — per-tick billing has no entitlement model
    make().siwx().metered({ tickCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects .siwx() after .metered()', () => {
    // @ts-expect-error — per-tick billing has no entitlement model
    make().metered({ tickCost: '0.001', maxPrice: '0.05' }).siwx();
  });
});

describe('.stream() requires .metered()', () => {
  it('rejects .stream() on .paid()', () => {
    make()
      .paid('0.01')
      // @ts-expect-error — streaming requires metered pricing
      .stream(async function* () {
        yield 'x';
      });
  });

  it('rejects .stream() on .upTo()', () => {
    make()
      .upTo('0.05')
      // @ts-expect-error — streaming is not supported on .upTo()
      .stream(async function* () {
        yield 'x';
      });
  });

  it('rejects .stream() on .unprotected()', () => {
    make()
      .unprotected()
      // @ts-expect-error — streaming requires metered pricing
      .stream(async function* () {
        yield 'x';
      });
  });
});

describe('body-derived pricing requires .body()', () => {
  it('rejects .handler() when .paid(fn) has no .body()', () => {
    make()
      .paid((body: { tokens: number }) => `${body.tokens}`, { maxPrice: '1.00' })
      // @ts-expect-error — body-derived pricing reads the parsed body
      .handler(async () => ({}));
  });

  it('rejects .handler() when tiered pricing has no .body()', () => {
    make()
      .paid({ field: 'tier', tiers: { sm: { price: '0.01' } } })
      // @ts-expect-error — tiered pricing reads the parsed body
      .handler(async () => ({}));
  });

  it('keeps requiring .body() across .siwx()', () => {
    make()
      .paid((body: { tokens: number }) => `${body.tokens}`, { maxPrice: '1.00' })
      .siwx()
      // @ts-expect-error — .siwx() does not satisfy body-derived pricing's .body() requirement
      .handler(async () => ({}));
  });
});

describe('documented-valid chains compile', () => {
  it('.paid().body().handler() with typed body', () => {
    const handler = make()
      .paid('0.01')
      .body(z.object({ q: z.string() }))
      .handler(async ({ body }) => {
        expectTypeOf(body).toEqualTypeOf<{ q: string }>();
        return { ok: true };
      });
    expectTypeOf(handler).toExtend<(request: NextRequest) => Promise<Response>>();
  });

  it('pay-once-replay and key+payment compositions', () => {
    make()
      .paid('0.01')
      .siwx()
      .handler(async ({ wallet }) => ({ wallet }));
    make()
      .siwx()
      .paid('0.01')
      .handler(async () => ({}));
    make()
      .apiKey(() => ({}))
      .paid('0.01')
      .handler(async () => ({}));
    make()
      .paid('0.01')
      .apiKey(() => ({}))
      .handler(async () => ({}));
  });

  it('.upTo() handler receives charge()', () => {
    make()
      .upTo('0.05')
      .body(z.object({ q: z.string() }))
      .handler(async ({ charge }) => {
        expectTypeOf(charge).toExtend<(amount: string) => Promise<void>>();
        return {};
      });
  });

  it('.metered().stream() receives no-arg charge()', () => {
    make()
      .metered({ tickCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
      .body(z.object({ prompt: z.string() }))
      .stream(async function* ({ body, charge }) {
        await charge();
        yield body.prompt;
      });
  });

  it('.metered().handler() request-mode billing', () => {
    make()
      .metered({ tickCost: '0.01', maxPrice: '0.05', unitType: 'request' })
      .handler(async () => ({}));
  });

  it('identity-only and open routes', () => {
    make()
      .siwx()
      .handler(async ({ wallet }) => ({ wallet }));
    make()
      .apiKey(() => ({ id: 1 }))
      .handler(async ({ account }) => ({ account }));
    make()
      .unprotected()
      .handler(async () => ({ status: 'ok' }));
  });

  it('body-derived pricing with .body() present', () => {
    make()
      .paid((body: { tokens: number }) => `${body.tokens * 0.001}`, { maxPrice: '5.00' })
      .body(z.object({ tokens: z.number() }))
      .handler(async ({ body }) => {
        expectTypeOf(body).toEqualTypeOf<{ tokens: number }>();
        return {};
      });
  });
});
