# Pre-open-source cleanup

Smells worth fixing before public launch. Numbers preserved from the review so they cross-reference the chat thread. Items not listed here (memory nonce fallback, headers in `RequestMeta`, eternal SIWX entitlements, static/dynamic flow split, payload.accepted handling, SIWX substring matching, etc.) are intentional design decisions and stay as-is.

---

## 1. `parseFloat` for money in dynamic + tiered pricing

- [ ] **Files:** `src/pricing/dynamic.ts:49-62`, `src/pricing/tiered.ts:55-61`
- **Smell:** `parseFloat(raw) > parseFloat(maxPrice)` to cap prices. A payments library doing float comparison on USDC strings is the screenshot. `pricing/atomic.ts` already implements correct BigInt decimal math.
- **Done when:**
  - Both cap paths route through `decimalToAtomic` (or a shared comparator) so comparison happens in `bigint`.
  - No `parseFloat` / `Number(` / `parseInt` remains in `src/pricing/`.
  - Existing pricing tests still pass; add cases for `"1e-7"`, `"  1  "`, `"0.0000001"`, `"0.1"+"0.2"` boundary inputs.
- **Scope note:** The decimal regex in `protocols/x402/requirements.ts:105-119` and `protocols/mpp/strategy.ts:132-142` (`multiplyDecimal`) are separate sites. Optional follow-up: route them through `atomic.ts` too, but that's a refactor, not a bug fix.

---

## 8. `RouteBuilder` has ~30 `@internal` underscore fields on a public class, and `createRouter` pokes one

- [ ] **Files:** `src/builder.ts:84-112` (declarations), `src/index.ts:163` (`builder._protocols = [...config.protocols]`)
- **Smell:** Fields tagged `@internal` in JSDoc but `public` in TS — the type ships in `dist/index.d.ts`, so the protection is illusory. The library itself bypasses it.
- **Done when:**
  - Either: `_*` fields become truly private (`#field` syntax or a private state object on the builder), and a real public mutator/seeder exists for the one path `index.ts:163` needs.
  - Or: drop the `@internal` JSDoc and rename to make it honest (still ugly, but no longer a lie).
  - `createRouter` no longer assigns to a `_`-prefixed field from outside the class.
- **Scope note:** A full builder-to-config-object refactor is a bigger redesign; this task is just "stop lying or stop bypassing."

---

## 9. Bidirectional `pipeline ↔ protocols` dependency

- [ ] **Files:** `src/protocols/types.ts:3` (imports `RouterDeps` from `pipeline/`), `src/pipeline/steps/types.ts:11` (imports `ResolvedX402Facilitator` from `protocols/`), plus four MPP files importing `MppxMiddlewareResponse` from `pipeline/steps/types.ts`.
- **Smell:** The "strategy" interface and the orchestrator share a types file; neither is a layer.
- **Done when:**
  - Define `PaymentStrategy` and its dependencies (`RouterDeps`, the deps subset it actually needs) in a leaf module that neither pipeline nor protocols owns — e.g., `src/protocols/contract.ts` or `src/types.ts` — and have both sides import from it.
  - `protocols/` no longer imports from `pipeline/`. `pipeline/steps/types.ts` no longer imports from `protocols/`.
  - `mppx` middleware types move out of `pipeline/steps/types.ts` (currently a god-types file) into a co-located home — probably `src/init/mppx.ts` or a new `src/protocols/mpp/middleware-types.ts`.


## 12. `RouterPlugin`: 10-method reflective interface with zero in-repo consumers

- [ ] **Files:** `src/plugin/index.ts:70-122`, every `firePluginHook(...)` call site
- **Smell:** 10 optional methods, reflection-by-method-name dispatch (`keyof RouterPlugin`), every call wrapped in `try/catch` because the authors don't trust the extension point. No first-party plugin in the tree.
- **Done when:** Pick one:
  - **(a) Shrink the surface.** Keep only the hooks you actually intend to support post-launch (likely a small subset: `onRequest`, `onResponse`, `onPaymentVerified`, `onError`). Drop the rest. Re-evaluate `try/catch`-around-everything once the surface is smaller.
  - **(b) Ship a real first-party plugin** that exercises the full surface (e.g., a logging plugin in `examples/` or a built-in `consolePlugin`). Then the surface stops looking like scaffolding.
- **Scope note:** Whichever path, document the plugin contract in README or AGENTS.md so it's clear what's stable.

---

## 14. Naming sprawl for "build a payment challenge"

- [ ] **Functions:** `build402`, `buildChallenge`, `buildChallengeRequirements`, `buildSdkHandledRequirements`, `buildCustomRequirement`, `buildSiwxChallenge`, `buildSessionChallenge` (search `grep -rn 'build[A-Z]' src/`)
- **Smell:** Same concept, six-plus names. `build402` is named after the HTTP status code instead of the domain concept.
- **Done when:**
  - One verb ("`build`") + one noun ("`Challenge`") backbone, with consistent suffixes for the variants — e.g., `buildChallenge`, `buildSiwxChallenge`, `buildSessionChallenge`, `buildPaymentRequirements`.
  - `build402` is renamed. No function in `src/` is named after its HTTP status code.
  - Naming guide note in `AGENTS.md` (one paragraph) so future contributors don't drift.

---

## 16. `tieredPricing.challengeQuote` has a sync `try/catch` around an async call

- [ ] **File:** `src/pricing/tiered.ts:32-41`
- **Smell:** `try { return this.quote(body); } catch { /* fall through */ }` — `quote` returns a `Promise`; rejection escapes the sync `catch`, so the fallthrough never fires. A missing tier field rejects the returned promise instead of falling back to `maxTierPrice()`.
- **Done when:**
  - The function is `async`, with `try { return await this.quote(body); } catch { return this.maxTierPrice(); }`.
  - Add a test: tiered pricing with a body missing the discriminator field falls back to max-tier price instead of rejecting.

---

## 18. `JSON.parse` silently returns `undefined` on malformed bodies

- [ ] **File:** `src/pipeline/body.ts:6-10`
- **Smell:** `try { return JSON.parse(text); } catch { return undefined; }`. Indistinguishable from an empty body. A route with `.unprotected()` and no Zod schema runs against `body=undefined` even when the client sent garbage JSON.
- **Done when:**
  - Malformed JSON produces a 400 response (or whatever the library's standard validation-failure shape is), not `undefined`.
  - Empty body remains valid (returns `undefined` or `{}` per current contract — don't change that semantics).
  - Test: a POST with body `"{not json"` and `content-type: application/json` returns 400, not 200.
- **Scope note:** Check whether downstream code already handles this via Zod when a schema is supplied — the bug is the no-schema path.

---

## 20. Empty `dist/client/` ships in the npm tarball

- [ ] **Path:** `dist/client/` (empty since 29 Apr), `package.json:21-25` (`files: ["dist", ...]`)
- **Smell:** Leftover from a long-removed client-side entry point. Ships as dead weight.
- **Done when:**
  - The empty directory is gone (likely a stale `tsup` output path — check `tsup.config.ts`).
  - Either `tsup` no longer emits `dist/client/`, or `files` in `package.json` is narrowed to exclude it.
  - `npm pack --dry-run` shows no `dist/client/` entry.

---
