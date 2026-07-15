---
'@agentcash/router': minor
---

Enforce CAIP-2 network identifiers at the type level and document the keyless local-dev path.

- New exported `X402Network` type (`` `eip155:${string}` | `solana:${string}` ``), now used by `RouterConfig.network` and `X402AcceptConfig.network`. Friendly names like `'base-sepolia'` are rejected at compile time instead of throwing `unsupported_x402_network` at construction. TS consumers passing a plain `string` variable for `network` will need to narrow it (or use the exported constants `BASE_MAINNET_NETWORK` / `SOLANA_MAINNET_NETWORK`); the runtime validator is unchanged.
- Fixed JSDoc on `network` fields that incorrectly suggested friendly names (`base`, `base-sepolia`, `solana-mainnet`) and a wrong `@default 'base'`.
- The `missing_cdp_keys` error now notes that Coinbase CDP signup requires phone verification and that placeholder key values are a supported local-dev path (paid routes serve correct 402 challenges via the hardcoded facilitator baseline; real keys are only needed to verify/settle payments). Same guidance added to the README quickstart, `createRouter`/`createRouterFromEnv` JSDoc, `AGENTS.md`, and `.env.example`.
