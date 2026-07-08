---
'@agentcash/router': minor
---

Deprecate `RouterConfig.prices` (and `CreateRouterFromEnvOptions.prices`); add `discovery.expectRoutes` as the barrel-validation replacement.

The prices map did three jobs: central price list, auto-applying `.paid(prices[key])` on `.route(key)`, and doubling as a manifest that discovery validates against to catch missing barrel imports. In practice the fleet prices inline with `.paid()` (34 of 49 services; 12 more pass a do-nothing `prices: {}`), auto-priced routes can't take pricing options, and threading price keys through the type system is the only reason `createRouter` is generic — the machinery behind the recent "type instantiation is excessively deep" failures.

- `prices` still works exactly as before, but is `@deprecated` and `createRouter` logs a one-time deprecation warning when it's passed (including an empty map). It will be removed in the next major.
- New `discovery.expectRoutes?: readonly string[]` (also a top-level `expectRoutes` option on `createRouterFromEnv`) keeps the completeness check: discovery handlers throw `route 'X' expected but not registered — add to barrel imports` until every listed key is registered. During the deprecation window, prices keys and `expectRoutes` are unioned into the same check.
- Migration: replace `prices: { search: '0.01' }` + bare `.route('search')` with `.route('search').paid(PRICES.search)` (keep a central `PRICES` const if you want one file of prices) and list keys in `discovery.expectRoutes`.
