---
'@agentcash/router': minor
---

Deprecate `RouterConfig.prices` (and `CreateRouterFromEnvOptions.prices`); fix prototype-chain key lookup in the prices map.

- `prices` is marked `@deprecated` (JSDoc only — no runtime change; auto-pricing and barrel validation keep working until removal in the next major). Every fleet service already prices inline with `.paid()`; auto-priced routes can't take pricing options, and the map is the only reason `createRouter` is generic. Migration: `.route('search').paid(PRICES.search)` with an optional central `PRICES` const; for the map's barrel-validation side effect, use a consumer-side test that globs route files and asserts `router.registry.has(key)`, or the catch-all adapter where a missing import 404s in dev.
- Fixed: the auto-pricing lookup used `key in config.prices`, which walks the prototype chain — a route named `toString`/`valueOf`/etc. on any router with a prices map picked up the inherited function as its "price" and threw at registration. Now `Object.hasOwn`.
