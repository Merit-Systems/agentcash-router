---
'@agentcash/router': minor
---

`routerConfigFromEnv` / `createRouterFromEnv` now require one of `MPP_SECRET_KEY` or the CDP key pair, and infer enabled protocols from whichever credentials are present — MPP-only services no longer need Coinbase credentials.

- x402 is auto-enabled when `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` are set, mirroring how `MPP_SECRET_KEY` toggles MPP. Default protocols: CDP keys only → `['x402']`, MPP secret only → `['mpp']`, both → `['x402', 'mpp']`. An explicit `protocols` option still overrides inference.
- Neither credential set → new `missing_payment_credentials` issue in the up-front `RouterConfigError` (previously an MPP-less env failed later at `createRouter` with `missing_cdp_keys`).
- A partial CDP pair is treated as x402 intent and fails fast with `missing_cdp_keys` naming the missing variable, as does an explicit `protocols` including `'x402'` without CDP keys.
- Soft `console.warn` when `SOLANA_PAYEE_ADDRESS` is set while x402 is disabled, since the Solana accept would otherwise silently never be served.
- Programmatic `createRouter(config)` validation is unchanged: CDP keys are required only when the config has EVM x402 accepts.
