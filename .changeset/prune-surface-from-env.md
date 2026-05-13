---
'@agentcash/router': minor
---

Prune public surface, add `createRouterFromEnv`, normalize constants (#225).

**New: `createRouterFromEnv`.** Paved-road entry point that reads `process.env`,
validates every value up front, and throws a single `RouterConfigError` with
every problem at once. Auto-enables MPP when `MPP_SECRET_KEY` is set, auto-adds
a Solana accept when `SOLANA_PAYEE_ADDRESS` is set, auto-enables MPP session
mode when `MPP_OPERATOR_KEY` is set. Env vars are documented on the function's
own JSDoc (grouped x402 / Solana / MPP / Other); a copy-paste `.env.example`
ships at the repo root.

**Pruned public surface.** ~60 exports removed from `src/index.ts` — store
classes, the `RouterConfigError` toolkit, `consolePlugin`, internal plugin
sub-types, `RouteBuilder`/`RouteRegistry`, and monitor/quota/alert plumbing.
The underlying source is unchanged; these symbols just stop being re-exported.
`knip` is wired into `pnpm check` so this stays clean. Consumers that imported
any of the removed symbols by name will need to inline or rebuild equivalent
logic.

**Constant renames** (breaking for anyone importing these by name):

- `BASE_NETWORK` → `BASE_MAINNET_NETWORK`
- `BASE_USDC_ASSET` → `BASE_USDC_ADDRESS`
- `TEMPO_USDC_CURRENCY` → `TEMPO_USDC_ADDRESS`
- Adds `TEMPO_USDC_DECIMALS` for Base/Tempo symmetry; removes the duplicate
  `DEFAULT_SOLANA_FACILITATOR_URL`.

**Other:**

- Solana flagged as exact-only across env tables and `.env` files (dynamic
  `upto` pricing is Base-only).
- CI runs `pnpm check` directly so it can't drift from local.
- README rewritten around install / env / quick-start / auth-modes / pricing
  / discovery, with the AgentCash wordmark and tagline at the top.
