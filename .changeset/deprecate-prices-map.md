---
'@agentcash/router': minor
---

Deprecate `RouterConfig.prices` (and `CreateRouterFromEnvOptions.prices`).

The prices map did three jobs: central price list, auto-applying `.paid(prices[key])` on `.route(key)`, and doubling as a manifest that discovery validates against to catch missing barrel imports. In practice the fleet prices inline with `.paid()` (34 of 49 services; 12 more pass a do-nothing `prices: {}`), auto-priced routes can't take pricing options, and threading price keys through the type system is the only reason `createRouter` is generic — the machinery behind the recent "type instantiation is excessively deep" failures.

- `prices` still works exactly as before (auto-pricing, barrel validation, types), but is `@deprecated` and `createRouter` logs a one-time deprecation warning when it's passed (including an empty map). It will be removed in the next major.
- Migration: replace `prices: { search: '0.01' }` + bare `.route('search')` with `.route('search').paid(PRICES.search)` — keep a central `PRICES` const if you want one file of prices. If you valued the barrel-completeness validation, add a consumer-side test that globs your route files and asserts `router.registry.has(key)`, or serve routes through the catch-all adapter (`@agentcash/router/next`) where a forgotten import 404s in dev.
