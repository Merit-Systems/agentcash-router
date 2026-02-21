---
"@agentcash/router": patch
---

fix: correct default type parameter so `.siwx().body()` works without `prices` config

`createRouter()` without a `prices` config caused `.route(key).siwx().body(schema)` to error with
"Property 'body' does not exist on type 'never'". The default generic `Record<string, never>` made
`keyof P` resolve to `string`, so every route key matched as auto-priced (`HasAuth = true`), and
`.siwx()` returned `never`. Changed the default to `Record<never, string>` so `keyof P` correctly
resolves to `never` when no prices are configured.
