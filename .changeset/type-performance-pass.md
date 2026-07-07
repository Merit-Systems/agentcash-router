---
'@agentcash/router': minor
---

Type-performance pass: eliminate the consumer-side "Type instantiation is excessively deep" hazard and shrink per-route check cost.

- `createRouter` / `createRouterFromEnv` no longer capture the whole config as a `const` generic. Inference is scoped to the `prices` map (`PriceKeysOf<P>`), so the router's exported type is a small named type instead of a deferred conditional over the entire config literal (guidance strings, accepts tuples, plugin closures). Large configs previously left that conditional unresolved until some consumer file forced it at the bottom of an already-deep check stack — tripping TS's instantiation-depth limit check-order-dependently (seen on Vercel builds). The `router: ServiceRouter` annotation workaround is no longer needed.
- `.body()` / `.query()` / `.output()` are now generic over the schema (`S extends ZodType`, output via lazy `z.output<S>`) instead of extracting `T` from `ZodType<T>`, which structurally walked zod's internals per call. Router-heavy route files check 2–8× faster (e.g. 13.3ms → 1.7ms) in a traced consumer build. Handler `ctx.body` / `ctx.query` types are unchanged. Note: an explicit type argument to these methods now names the schema type, not the output type.
- `zod` is now declared as a peer dependency (`^4.0.0`). It was previously undeclared (dev-only) while being imported at runtime, which resolved by hoisting luck and gave consumers a second zod copy — paying cross-copy structural comparisons on every `.body(schema)` chain.
