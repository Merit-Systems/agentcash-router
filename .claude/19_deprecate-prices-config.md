# Deprecate `prices` Config on `createRouter()`

**Date:** 2026-02-21
**Status:** Proposed
**Relates to:** PR #68 (fix default type param), type inference bug in stabledomains

---

## Summary

Remove the `prices` config from `createRouter()` and the `TPriceKeys` conditional
type system that supports it. All pricing should go through the `.paid()` chain API.

## Background

`createRouter()` accepts an optional `prices` record that maps route keys to static
price strings. When present, `route(key)` auto-calls `.paid()` for matching keys,
skipping the manual chain call. This is powered by a `TPriceKeys` generic that feeds
a conditional return type on `route()`:

```typescript
export interface ServiceRouter<TPriceKeys extends string = never> {
  route<K extends string>(key: K):
    [K] extends [TPriceKeys]
      ? RouteBuilder<..., true, ...>   // auto-priced
      : RouteBuilder<..., false, ...>; // manual
}
```

## Why Remove It

### 1. It caused a real bug (PR #68)

The default type parameter `Record<string, never>` made `keyof P` resolve to
`string`, so TypeScript treated every route as auto-priced when `prices` was omitted.
This made `.siwx().body()` return `never`, blocking stabledomains deployment. The fix
(changing to `Record<never, string>`) was a one-liner, but the conditional type
system is the deeper problem.

### 2. It only supports static pricing

`prices` only accepts `Record<string, string>` — flat key-to-price mappings.
Dynamic pricing (`(body) => price`), tiered pricing (`{ field, tiers }`), and
options like `maxPrice`/`minPrice`/`payTo` all require manual `.paid()` anyway.
The shortcut covers the simplest case and nothing else.

### 3. Two mental models for one concept

Developers must understand both "config-level pricing" and "chain-level pricing"
and know when each applies. This is unnecessary complexity — `.paid()` covers
every case.

### 4. Most consumers don't use it

Of 8 apps in the-stables monorepo:
- **3 use it genuinely:** stableemail, stablesocial, stableenrich
- **5 have `prices: {}`** as a type-system workaround (now fixed by PR #68, but
  the pattern persists in codebases)

### 5. The "central price table" benefit survives without it

The main value of `prices` is seeing all prices in one place. This works just as
well with a shared constant:

```typescript
// Before (auto-pricing):
const router = createRouter({
  prices: { "send": "0.02", "forward": "0.005" },
});
router.route("send").body(schema).handler(...);

// After (manual .paid(), same central table):
export const PRICES = { "send": "0.02", "forward": "0.005" } as const;

const router = createRouter({ ... }); // no prices field
router.route("send").paid(PRICES["send"]).body(schema).handler(...);
```

The price table still exists, it's just a constant instead of a config field.
Discovery/well-known reads from the route registry regardless — `.paid()` populates
it the same way.

## What Gets Removed

1. **`prices` field** on `createRouter()` config
2. **`TPriceKeys` generic** on `ServiceRouter` interface
3. **Conditional return type** on `route()` — always returns
   `RouteBuilder<undefined, undefined, false, false, false>`
4. **`as never` casts** in the `route()` implementation
5. **`pricesKeys`** variable and `registry.validate(pricesKeys)` call in well-known
   (or repurpose validation to work from registry directly)

## What Stays

- `.paid(price)`, `.paid(fn)`, `.paid({ tiers })` — all chain-level pricing
- Discovery, OpenAPI, well-known — all read from registry, unaffected
- Every other auth mode: `.siwx()`, `.apiKey()`, `.unprotected()`

## Migration for the-stables Apps

### Apps with real prices (need migration)

**stableemail** — 12 static prices:
```typescript
// Before
createRouter({ prices: { 'send': '0.02', 'subdomain/buy': '5', ... } });
router.route("send").body(schema).handler(...);

// After
export const PRICES = { 'send': '0.02', 'subdomain/buy': '5', ... } as const;
router.route("send").paid(PRICES["send"]).body(schema).handler(...);
```

**stableenrich** — builds prices from `BASE_PRICES` config:
```typescript
// Before
const prices = Object.fromEntries(
  (Object.keys(BASE_PRICES) as RouteKey[]).map(key => [key, getPrice(key)])
);
createRouter({ prices });

// After — just call .paid() with getPrice() at each route
router.route("enrich/company").paid(getPrice("enrich/company")).body(...).handler(...);
```

**stablesocial** — uses `PRICES` constant (already has the table, just move `.paid()` to chain):
```typescript
router.route("social/post").paid(PRICES["social/post"]).body(...).handler(...);
```

### Apps with `prices: {}` (just delete the line)

stablestudio, stableupload, stablephone, stablejobs, stabledomains — remove
`prices: {}` from the config. No other changes needed.

## Approach

1. **Phase 1 (router):** Deprecate `prices` with a console.warn, keep it working.
   Remove `TPriceKeys` conditional type — `route()` always returns the non-priced
   builder. Apps using `prices` still work at runtime but get a deprecation warning.
2. **Phase 2 (the-stables):** Migrate the 3 apps that use real prices to manual
   `.paid()`. Remove `prices: {}` from the other 5.
3. **Phase 3 (router):** Remove `prices` config entirely in a minor version bump.

## Non-Goals

- Changing how `.paid()` works
- Changing discovery/OpenAPI generation
- Adding new pricing features
