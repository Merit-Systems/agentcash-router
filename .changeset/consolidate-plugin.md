---
'@agentcash/router': patch
---

Internal restructure bundling four refactors. No public API change — every
named export and config option behaves identically.

**Plugin consolidation:**

- `src/plugin.ts` → `src/plugin/index.ts`
- `src/alert.ts` → `src/plugin/reporter.ts`
- `src/pipeline/context/plugin-events.ts` → `src/plugin/events.ts`, with new
  `fireAuthVerified`, `firePaymentVerified`, `firePaymentSettled` helpers
  plus the migrated `firePluginResponse` and `fireProviderQuota`. The two
  old single-helper files are gone.
- 17 pipeline files collapse their inline plugin-hook fires to one-line
  helper calls. `firePluginHook` is now imported by 4 files instead of 18.
- Inline `onAlert` fires unify through `ctx.report`; the handler-facing
  `ctx.alert` shims alias `ctx.report` directly.

**src/ layout cleanup:**

- Top-level pipeline files moved into `src/pipeline/`:
  `orchestrate.ts`, `handler.ts`, `body.ts`, `alert.ts`.
- Init surfaces consolidated under `src/init/`:
  `src/server.ts` → `src/init/x402-server.ts`,
  `src/mppx-init.ts` → `src/init/mppx.ts`.
- `src/pipeline/context/` renamed to `src/pipeline/steps/` — the 22 files
  inside are pipeline steps, not "context" operations.

**Docs pruning + README rewrite:**

- Strips ~29.7k lines of agent handoff docs, plan files, and vendored MPP
  documentation under `.claude/` and `.plan/`.
- Replaces the 656-line README with a 275-line rewrite organized around
  install / env / quick-start / auth-modes / pricing / discovery.
- Adds `AGENTS.md` at the repo root capturing the critical invariants that
  previously lived in `.claude/CLAUDE.md`: error `.status` semantics, SIWX
  challenge format, discovery visibility rules, duplicate-key behavior,
  dynamic-pricing body parse, and the MPP operator vs fee-payer vs
  recipient invariants.
- `package.json` `files` field now ships `AGENTS.md` + `README.md` instead
  of the old `.claude/` paths.

**Examples + tests reorganization:**

- `examples/mpp-native/` and `examples/x402-native/` removed — they
  duplicated router demos already covered by `examples/fortune/`.
- `examples/fortune/test-session-alignment.ts` and `test-x402-exact-upto.ts`
  moved to `tests/integration/` (they were always smoke tests, not example
  apps), with a `tests/integration/README.md` covering how to run them
  against live RPC endpoints.
