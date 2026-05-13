---
'@agentcash/router': minor
---

Cleanup and paved-road release. Public API gains `createRouterFromEnv` and
loses ~60 incidental re-exports. Plugin internals and `src/` layout are
consolidated.

**Paved-road init: `createRouterFromEnv`** (#225). Reads `process.env`,
validates every value up front, and throws a single `RouterConfigError` with
every problem at once. Auto-enables MPP when `MPP_SECRET_KEY` is set,
auto-adds a Solana accept when `SOLANA_PAYEE_ADDRESS` is set, auto-enables
MPP session mode when `MPP_OPERATOR_KEY` is set. Env vars are documented on
the function's own JSDoc (grouped x402 / Solana / MPP / Other); a copy-paste
`.env.example` ships at the repo root.

**Pruned public surface** (#225). ~60 exports removed from `src/index.ts` —
store classes, the `RouterConfigError` toolkit, `consolePlugin`, internal
plugin sub-types, `RouteBuilder`/`RouteRegistry`, and monitor/quota/alert
plumbing. The underlying source is unchanged; these symbols just stop being
re-exported. `knip` is wired into `pnpm check` so this stays clean. Consumers
that imported any of the removed symbols by name will need to inline or
rebuild equivalent logic.

**Constant renames** (#225):

- `BASE_NETWORK` → `BASE_MAINNET_NETWORK`
- `BASE_USDC_ASSET` → `BASE_USDC_ADDRESS`
- `TEMPO_USDC_CURRENCY` → `TEMPO_USDC_ADDRESS`
- Adds `TEMPO_USDC_DECIMALS` for Base/Tempo symmetry; removes the duplicate
  `DEFAULT_SOLANA_FACILITATOR_URL`.

**Plugin internals consolidated** (#220).

- `src/plugin.ts` → `src/plugin/index.ts`,
  `src/alert.ts` → `src/plugin/reporter.ts`,
  `src/pipeline/context/plugin-events.ts` → `src/plugin/events.ts` with new
  `fireAuthVerified` / `firePaymentVerified` / `firePaymentSettled` helpers
  plus the migrated `firePluginResponse` and `fireProviderQuota`.
- 17 pipeline files collapse their inline plugin-hook fires to one-line
  helper calls. `firePluginHook` is now imported by 4 files instead of 18.
- Inline `onAlert` fires unify through `ctx.report`; the handler-facing
  `ctx.alert` shims alias `ctx.report` directly.

**`src/` layout cleanup** (#220).

- Top-level pipeline files moved into `src/pipeline/`:
  `orchestrate.ts`, `handler.ts`, `body.ts`, `alert.ts`.
- Init surfaces consolidated under `src/init/`:
  `src/server.ts` → `src/init/x402-server.ts`,
  `src/mppx-init.ts` → `src/init/mppx.ts`.
- `src/pipeline/context/` renamed to `src/pipeline/steps/` — the 22 files
  inside are pipeline steps, not "context" operations.

**Docs + examples** (#220, #225).

- README rewritten (656 → ~270 lines) around install / env / quick-start /
  auth-modes / pricing / discovery, with the AgentCash wordmark and tagline
  at the top.
- `AGENTS.md` at the repo root captures the critical invariants that
  previously lived in `.claude/CLAUDE.md`: error `.status` semantics, SIWX
  challenge format, discovery visibility rules, duplicate-key behavior,
  dynamic-pricing body parse, and the MPP operator vs fee-payer vs recipient
  invariants. `package.json` `files` now ships `AGENTS.md` + `README.md`
  instead of the old `.claude/` paths.
- `examples/mpp-native/` and `examples/x402-native/` removed — they
  duplicated demos already covered by `examples/fortune/`.
- `examples/fortune/test-session-alignment.ts` and
  `test-x402-exact-upto.ts` moved to `tests/integration/` with a
  `tests/integration/README.md` covering how to run them against live RPC
  endpoints.
- Solana flagged as exact-only across env tables and `.env` files (dynamic
  `upto` pricing is Base-only).

**CI** (#225). Runs `pnpm check` directly so it can't drift from local.
