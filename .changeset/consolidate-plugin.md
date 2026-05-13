---
'@agentcash/router': patch
---

Consolidate plugin-related modules into `src/plugin/`. No public API change —
`consolePlugin` and the plugin type exports (`RouterPlugin`, `PluginContext`,
event types) still ship from `@agentcash/router`.

**Internal restructure:**

- `src/plugin.ts` → `src/plugin/index.ts`
- `src/alert.ts` → `src/plugin/reporter.ts`
- `src/pipeline/context/plugin-events.ts` → `src/plugin/events.ts` (new
  helpers: `fireAuthVerified`, `firePaymentVerified`, `firePaymentSettled`,
  plus migrated `firePluginResponse` and `fireProviderQuota`)
- `src/pipeline/context/fire-plugin-response.ts` and `fire-provider-quota.ts`
  deleted; content moved into `src/plugin/events.ts`

**Why:** `firePluginHook` was called inline from 17 files across the pipeline
with multi-line object literals at each call site. The new helpers reduce
every plugin-hook fire to one line. `firePluginHook` is now confined to four
files (the dispatcher, `createReporter`, the `onRequest` preflight, and the
fire-event helpers).

Inline `onAlert` fires across the pipeline are unified through `ctx.report`,
and the handler-facing `ctx.alert` shims now alias `ctx.report` directly.
