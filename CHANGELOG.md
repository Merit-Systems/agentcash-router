# @agentcash/router

## 0.6.8

### Patch Changes

- 20137d9: Bump mppx to 0.3.8

## 0.6.7

### Patch Changes

- 6a0663b: Normalize MPP credential source DID to plain address. MPP credentials use `did:pkh:eip155:<chainId>:<address>` format, but SIWX and x402 return plain `0x...` addresses. Without normalization, jobs created via MPP can't be fetched via SIWX because the wallet strings don't match.

## 0.6.6

### Patch Changes

- 4cd88b7: BREAKING: `baseUrl` is now required in `RouterConfig`. Removed `VERCEL_URL` auto-detection and `localhost` fallback.

  The realm derived from `baseUrl` is load-bearing for payment matching (MPP memo indexing, 402 challenge realm). `VERCEL_URL` returned the internal deployment URL (e.g. `*.vercel.app`) rather than the custom domain, causing payment indexing failures in production.

  Migration: pass `baseUrl` explicitly in your `createRouter()` call.

  ```typescript
  createRouter({
    baseUrl: process.env.BASE_URL!,
    // ...
  });
  ```

## 0.6.5

### Patch Changes

- 11f3a82: fix: auto-detect baseUrl from VERCEL_URL, remove NEXT_PUBLIC_BASE_URL

  baseUrl is now auto-resolved: `config.baseUrl` > `VERCEL_URL` > `localhost:PORT`.
  Consumers on Vercel no longer need to pass baseUrl or set any custom env vars.
  The `NEXT_PUBLIC_BASE_URL` fallback has been removed.

## 0.6.4

### Patch Changes

- 3d20c19: fix: return 402 on discovery probes with empty/invalid body

  When a discovery client (e.g. x402scan) sends a POST with an empty body and no
  payment headers, the early body parsing returned 400 before the 402 challenge
  was built. Now body parse failures with no payment header fall through to
  `build402()` using `maxPrice`, ensuring resources are always discoverable.

  Affects both x402 and MPP protocols. `validateFn` errors on valid bodies still
  return their error status as before.

## 0.6.3

### Patch Changes

- 17ab73c: body parsing

## 0.6.2

### Patch Changes

- af0ea97: fix: correct default type parameter so `.siwx().body()` works without `prices` config

  `createRouter()` without a `prices` config caused `.route(key).siwx().body(schema)` to error with
  "Property 'body' does not exist on type 'never'". The default generic `Record<string, never>` made
  `keyof P` resolve to `string`, so every route key matched as auto-priced (`HasAuth = true`), and
  `.siwx()` returned `never`. Changed the default to `Record<never, string>` so `keyof P` correctly
  resolves to `never` when no prices are configured.

## 0.6.1

### Patch Changes

- ab838c0: Bump mppx to 0.3.4

## 0.6.0

### Minor Changes

- 9b3a5c6: Add `payTo` option to `.paid()` for dynamic payment recipients. Accepts a static string or an async function that receives the `Request` and returns the recipient address. Falls back to the router's default `payeeAddress` when not set.

## 0.5.2

### Patch Changes

- 851fee6: Fix facilitator 429 rate limits on Vercel cold starts breaking all paid routes
  - Hardcode `getSupported()` for EVM exact scheme — eliminates the HTTP call to CDP facilitator on every cold start. `verify()` and `settle()` still use the real facilitator.
  - Return 500 (not bare 402) when x402 challenge build fails — operators see a clear error instead of clients getting an unpayable 402 with no payment info.

## 0.5.1

### Patch Changes

- 89b9bc0: remove trailing slash, bump

## 0.5.0

### Minor Changes

- a16fab7: Require baseUrl in config, or NEXT_PUBLIC_BASE_URL

### Patch Changes

- 897c761: Bump mppx

## 0.4.10

### Patch Changes

- 9b05697: Bump mppx to 0.2.5

## 0.4.9

### Patch Changes

- 9a1c154: massive simplification of mpp logic
- 2bacbc2: fix price tieres'

## 0.4.8

### Patch Changes

- 9f87e41: mppx version bump
- 86f777a: tiered pricing

## 0.4.7

### Patch Changes

- fix(siwx): alphanumeric nonce and supportedChains for spec compliance

## 0.4.6

### Patch Changes

- 2c7f244: logs

## 0.4.5

### Patch Changes

- b058ea6: bump mppx to 0.2.0

## 0.4.4

### Patch Changes

- 3aa200d: returning 500 on settlement failures

## 0.4.3

### Patch Changes

- 9aa6935: move to mppx
