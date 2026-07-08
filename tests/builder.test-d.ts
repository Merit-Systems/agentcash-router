// Type-level tests for the builder's compile-time invariants — typechecked by
// vitest (never executed). An unused `@ts-expect-error` fails the suite.
import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
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
    // @ts-expect-error
    make().handler(async () => ({}));
  });

  it('rejects .body().handler() with no auth mode', () => {
    make()
      .body(z.object({ q: z.string() }))
      // @ts-expect-error
      .handler(async () => ({}));
  });
});

describe('pricing modes are mutually exclusive', () => {
  it('rejects a second .paid()', () => {
    // @ts-expect-error
    make().paid('0.01').paid('0.02');
  });

  it('rejects .upTo() after .paid()', () => {
    // @ts-expect-error
    make().paid('0.01').upTo('0.05');
  });

  it('rejects .session() after .upTo()', () => {
    // @ts-expect-error
    make().upTo('0.05').session({ unitCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects .paid() after .session()', () => {
    // @ts-expect-error
    make().session({ unitCost: '0.001', maxPrice: '0.05' }).paid('0.01');
  });

  it('rejects .metered() (deprecated alias) after .upTo()', () => {
    // @ts-expect-error
    make().upTo('0.05').metered({ tickCost: '0.001', maxPrice: '0.05' });
  });
});

describe('.session() option keys', () => {
  it('accepts unitCost or the deprecated tickCost, not both', () => {
    make()
      .session({ unitCost: '0.001', maxPrice: '0.05' })
      .stream(async function* ({ charge }) {
        await charge();
        yield 'ok';
      });
    make()
      .session({ tickCost: '0.001', maxPrice: '0.05' })
      .stream(async function* ({ charge }) {
        await charge();
        yield 'ok';
      });
    // @ts-expect-error — unitCost and tickCost are mutually exclusive
    make().session({ unitCost: '0.001', tickCost: '0.001', maxPrice: '0.05' });
  });
});

describe('.unprotected() excludes every other mode', () => {
  it('rejects pricing after .unprotected()', () => {
    // @ts-expect-error
    make().unprotected().paid('0.01');
    // @ts-expect-error
    make().unprotected().upTo('0.05');
    // @ts-expect-error
    make().unprotected().metered({ tickCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects identity after .unprotected()', () => {
    // @ts-expect-error
    make().unprotected().siwx();
    // @ts-expect-error
    make()
      .unprotected()
      .apiKey(() => ({}));
  });

  it('rejects .unprotected() after any auth mode', () => {
    // @ts-expect-error
    make().paid('0.01').unprotected();
    // @ts-expect-error
    make().siwx().unprotected();
    // @ts-expect-error
    make()
      .apiKey(() => ({}))
      .unprotected();
  });
});

describe('.siwx() and .apiKey() are mutually exclusive', () => {
  it('rejects .apiKey() after .siwx()', () => {
    // @ts-expect-error
    make()
      .siwx()
      .apiKey(() => ({}));
  });

  it('rejects .siwx() after .apiKey()', () => {
    // @ts-expect-error
    make()
      .apiKey(() => ({}))
      .siwx();
  });
});

describe('.session() and .siwx() are mutually exclusive', () => {
  it('rejects .session() after .siwx()', () => {
    // @ts-expect-error
    make().siwx().session({ unitCost: '0.001', maxPrice: '0.05' });
  });

  it('rejects .siwx() after .session()', () => {
    // @ts-expect-error
    make().session({ unitCost: '0.001', maxPrice: '0.05' }).siwx();
  });

  it('rejects the deprecated .metered() alias after .siwx()', () => {
    // @ts-expect-error
    make().siwx().metered({ tickCost: '0.001', maxPrice: '0.05' });
  });
});

describe('.stream() requires .metered()', () => {
  it('rejects .stream() on .paid()', () => {
    make()
      .paid('0.01')
      // @ts-expect-error
      .stream(async function* () {
        yield 'x';
      });
  });

  it('rejects .stream() on .upTo()', () => {
    make()
      .upTo('0.05')
      // @ts-expect-error
      .stream(async function* () {
        yield 'x';
      });
  });

  it('rejects .stream() on .unprotected()', () => {
    make()
      .unprotected()
      // @ts-expect-error
      .stream(async function* () {
        yield 'x';
      });
  });
});

describe('body-derived pricing requires .body()', () => {
  it('rejects .handler() when .paid(fn) has no .body()', () => {
    make()
      .paid((body: { tokens: number }) => `${body.tokens}`, { maxPrice: '1.00' })
      // @ts-expect-error
      .handler(async () => ({}));
  });

  it('rejects .handler() when tiered pricing has no .body()', () => {
    make()
      .paid({ field: 'tier', tiers: { sm: { price: '0.01' } } })
      // @ts-expect-error
      .handler(async () => ({}));
  });

  it('keeps requiring .body() across .siwx()', () => {
    make()
      .paid((body: { tokens: number }) => `${body.tokens}`, { maxPrice: '1.00' })
      .siwx()
      // @ts-expect-error
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
    expectTypeOf(handler).toExtend<(request: Request) => Promise<Response>>();
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
