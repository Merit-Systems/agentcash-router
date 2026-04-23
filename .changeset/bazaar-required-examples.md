---
"@agentcash/router": minor
---

Fix bazaar discovery extension and require `.inputExample()` / `.outputExample()` on every route with a schema.

**Bug fixes (no opt-in needed):**

- `bazaar.info.input.method` is now populated from `routeEntry.method`. Previously omitted — the `@x402/extensions/bazaar` validator rejects declarations missing `method` (`QueryInput` requires `method ∈ {GET,HEAD,DELETE}`, `BodyInput` requires `{POST,PUT,PATCH}`), so no routes with schemas were indexable.
- The `output` block is now only emitted when a real example is registered. Previously emitted `output.example: {}`, which failed the user's `outputSchema` for every route with a required field on the response.
- `info.input.body` (body routes) and `info.input.queryParams` (query routes) are now populated from the registered example instead of defaulting to `{}`, which failed the user's `bodySchema` / `querySchema` whenever it had a required field.

**Breaking — new required builder steps:**

Every route using `.body()` / `.query()` must call `.inputExample(sample)` with a schema-conforming sample before `.handler()`. Every route using `.output()` must call `.outputExample(sample)`.

```ts
router.route('search')
  .paid('0.01')
  .body(SearchSchema)
  .inputExample({ query: 'hello world' })        // NEW — required
  .output(ResultsSchema)
  .outputExample({ results: [{ id: '1' }] })     // NEW — required
  .handler(async ({ body }) => { ... });
```

Enforcement is both:
- **Compile-time** via `.handler()` TS overloads — missing example calls fail typecheck.
- **Runtime** at module-load — examples are `safeParse`'d against their Zod schemas; a `.refine()`/`.min()`/etc. violation throws before the route is registered, surfacing as a `next build` failure with the specific issue path.

Migration: for every route with a schema, add `.inputExample(...)` / `.outputExample(...)` calls with conforming sample data. The Zod validator will tell you exactly which fields are off.
