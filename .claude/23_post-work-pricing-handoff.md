# 23. Post-work pricing — session handoff

**Status:** Plan locked, not yet implemented. Blocked on `mppx` version bump (user-chosen ordering — bump first, then build on top).

This doc captures everything decided in the conversation that produced docs 21 and 22, plus the clarifications that came after them, so the next session can pick up cold without re-deriving the design.

## Reading order when you come back

1. `21_x402-upto-research.md` — how upstream x402 implements `upto` (spec MUSTs, three-layer TS impl, where in source). Reference material; doesn't need to change.
2. `22_post-work-pricing-plan.md` — the implementation plan (Phase 1 = `.paid({ variable, maxPrice })` + `payment.setAmount()`, Phase 2 = `.session({ perUnit })` + `payment.tick()`). Already updated to reflect the runtime push-mode rejection (not registration-time).
3. This doc — what's left to do, plus context not captured in 21/22.

## Why this exists

We want a route whose price is decided **after the handler does work**, not from the request body alone. Two real shapes:
- **Variable single-charge** — LLM call charged on actual tokens, capped at `maxPrice`. Wire: x402 `upto` scheme today, MPP charge in pull mode falls out for free.
- **Per-unit streaming** — pay-per-token SSE. Wire: MPP sessions only, future Phase 2.

Today the router resolves dynamic price from body before the handler runs and locks it into both the 402 challenge and the eventual `settlePayment` call. That's fine for "price is a function of body" but not "price is a function of work performed."

## What x402 already gives us upstream

Already in our `src/server.ts:36-39`: `UptoEvmScheme` is registered for every EVM network. Already in tests (`tests/upto-scheme.test.ts`): config validation, challenge inclusion, verify→settle round trip with the `upto` scheme through orchestrate.

Missing: a way for the handler to communicate "settle for X" post-work. `src/orchestrate.ts:744-749` calls `settleX402Payment(server, verifyPayload, verifyRequirements)` with no override path. `src/protocols/x402.ts:387-398`'s `settleX402Payment` doesn't accept overrides. `HandlerContext.payment` is read-only metadata.

The fix is small: closure-scoped override carrier, inject `setAmount` into `ctx.payment`, thread the result into a new `overrides` argument on `settleX402Payment`, which forwards to the upstream `server.settlePayment(..., settlementOverrides)` (5th arg, exists in upstream since the `upto` scheme shipped).

## Clarifications not in 21/22

### `the-stables` compatibility — confirmed non-breaking

All current dynamic pricing in the-stables is **body-derived** (`(body) => price`), not post-work:
- `stablememes/api/caption`, `automeme`, `caption_gif`, `ai_meme` — `body.watermark ? '0.01' : '0.02'`
- `stablegiftcards/api/buy` — `pricingFn(body)` sums cart items
- `stableupload/api/site|renew|upload`, `stabledomains/api/register|check|renew`, `stablemerch/*` — function-of-body with `paidOpts({ maxPrice, minPrice })`

Phase 1 is purely additive. `PaidOptions.variable` is `?: boolean`; undefined means today's behavior. `payment.setAmount` exists on every paid request but throws synchronously when called on non-variable routes (loud failure for misuse, no effect on routes that don't call it). The closure override carrier defaults to `undefined`, which makes the new threading a pure no-op for existing routes:
- `settleX402Payment` called without overrides when override is undefined → identical to today.
- `mppx.charge({ amount: override ?? price })` → identical to today when no override.

`maxPrice` keeps its current "safety net + fallback" meaning on non-variable routes; on `variable: true` it gains the additional meaning "contract-enforced ceiling." Same field, no breaking change.

None of the surveyed the-stables routes would benefit from migrating to `variable: true` — they all already know their prices from the body. `variable` is for the case where you genuinely can't know until work has happened.

### MPP push vs pull — pull dominates, so the rule is narrower

From `MPP_DOCS.md` §"Push & pull modes": pull mode (transaction-payload) is the **default** in mppx; push mode (hash-payload) is opt-in via `tempo({ mode: 'push' })`. Every agent-style integration the router targets (mppx CLI, AgentCash, Tempo Wallet, Privy Agent CLI) defaults to pull because that's what enables `feePayer` gas sponsorship.

The plan was originally going to reject `variable` + MPP at registration. After confirming pull's prevalence, the plan in 22 was narrowed to: allow `variable` + MPP, but reject **at runtime** when a hash-payload credential arrives on a `variable` route — return 400 with a clear error pointing the client at `mode: 'pull'`, fire a `warn` plugin alert. Pull stays fully supported; push fails loudly when used with `variable`.

Discrimination is already in place at `src/orchestrate.ts:828` (`payloadType === 'transaction'` vs `'hash'`).

## Sequencing — mppx bump first

User chose to bump mppx version before implementing. Reasoning was implicit but reasonable: Phase 1's MPP threading touches `deps.mppx.charge({ amount })` calls in orchestrate; doing the version bump first means we land Phase 1 against the version we'll actually ship with, not a stale one. Also avoids merge churn if the bump introduces any signature changes.

After the mppx bump:
1. Re-verify `mppx.charge({ amount })` signature is unchanged (or absorb the change in the bump PR).
2. Spot-check whether the bumped version exposes any new session/streaming primitives that affect the Phase 2 design sketch in `22_post-work-pricing-plan.md` §"Phase 2".
3. Run `tests/upto-scheme.test.ts` and `tests/mpp.test.ts` (or equivalent) against the bumped version to make sure the existing happy paths still pass.

## Phase 1 implementation checklist

Pulled from `22_post-work-pricing-plan.md` §"Wire changes" + §"Code locations to touch", restated as a flat to-do:

1. **`src/types.ts`**
   - [ ] `HandlerPaymentContext` gains `setAmount(amount: string): void` when route is paid.
   - [ ] `PaidOptions` gains `variable?: boolean`.
   - [ ] `RouteEntry` gains `variablePrice?: boolean`.
2. **`src/builder.ts`**
   - [ ] `.paid()` accepts `{ variable }`. Validate: `variable: true` requires `maxPrice` and is incompatible with the tiered pricing object.
3. **Registration-time validation** (probably `src/builder.ts` or wherever route registration validates today)
   - [ ] If `variable: true` and x402 is in protocols, require at least one `upto` accept on a configured network. Error message should name the missing pieces.
   - [ ] Do NOT reject `variable: true` + MPP at registration — that's a runtime check (see step 6).
4. **`src/protocols/x402.ts:387`**
   - [ ] `settleX402Payment` accepts an optional `overrides?: { amount?: string }` and forwards as the 5th arg to `server.settlePayment(...)`.
5. **`src/orchestrate.ts`**
   - [ ] Closure-scoped `const override: { amount?: string } = {}` per request.
   - [ ] Inject `setAmount` into `ctx.payment` before invoking handler:
     - On `variable: true` routes: writes to `override.amount`. Last call wins.
     - On non-variable paid routes: throws `Error('setAmount() is only available on routes configured with .paid({ variable: true })')`.
   - [ ] x402 settle path (around line 745): pass `override.amount` through to `settleX402Payment`.
   - [ ] MPP charge path (around line 906, transaction-payload): use `override.amount ?? price` as the `mppx.charge({ amount })` argument.
   - [ ] Runtime guard before MPP hash-payload handler invocation (around line 1009-1013): if route is `variable` AND `payloadType === 'hash'`, return 400 with the documented error message and fire `warn` plugin alert. Don't invoke the handler.
   - [ ] SIWX entitlement guard (line 756-766 and equivalent in MPP): only call `entitlementStore.grant` if the effective settled amount > 0. (Open question 2 in plan §"Risks and open questions".)
   - [ ] Ensure `onPaymentSettled` plugin event reports the *effective* settled amount, not the originally-quoted maxPrice.
6. **`build402` / 402 challenge path** (`src/orchestrate.ts:1283-1285` ish)
   - [ ] For `variable` routes always use `maxPrice` as the challenge price (simpler than the current dynamic-pricing branch — `variable` skips the body-derived branch entirely).
7. **Tests** — new file `tests/post-work-pricing.test.ts`. Cases enumerated in `22_post-work-pricing-plan.md` §"Tests".
8. **Changeset** — `.changeset/post-work-pricing.md`. Type: `minor` (additive). Mention: new `.paid({ variable, maxPrice })` shape, new `payment.setAmount()`, runtime 400 for MPP push-mode on variable routes.
9. **CLAUDE.md** — under `Auth Modes` § `.paid(pricing)` add a brief subsection on `variable: true` with one example. Keep it tight; full reference lives in `22_post-work-pricing-plan.md`.

## Open questions deferred to implementation time

Restated from `22_post-work-pricing-plan.md` §"Risks and open questions":

1. **Cap clamping vs trust the contract.** Pre-validate `setAmount(x) <= maxPrice` client-side, or let the facilitator/contract reject? Plan recommends "trust the contract, warn on rejection." Revisit if it produces noisy operator alerts.
2. **`setAmount('0')` + entitlement.** A 0-charge settlement should NOT grant SIWX entitlement. Add `if (effectiveAmount > 0)` guard around `entitlementStore.grant`.
3. **`maxPrice` semantics drift.** Documented in CLAUDE.md as a deliberate overload; revisit if it confuses users.
4. **`onPaymentSettled` reporting.** Must use effective amount. Confirm plugin docs match.
5. **Cancellation.** Out of scope for Phase 1. If client disconnects after handler ran but before settle, today's behavior is "settle anyway"; with `setAmount('0')` we could be more graceful, but not required for this PR.

## Phase 2 design preserved

Don't touch `.session()` / `payment.tick()` in Phase 1. The plan in `22_post-work-pricing-plan.md` §"Phase 2" demonstrates that the Phase 1 API (`.paid({ variable })` + `payment.setAmount`) doesn't lock us out of the streaming shape — `.session()` is a sibling builder, `payment.tick()` is an orthogonal method on the same `payment` object, and the closure-scoped override carrier generalizes naturally to a `meter` object.

When Phase 2 lands, expected dependencies:
- mppx version that exposes `mppx.session({ amount, unitType })` (referenced throughout `MPP_DOCS.md` §"Accept pay-as-you-go payments" and §"Accept streamed payments").
- Optional: `sse: true` flag on the `tempo()` config, for streaming variants.
- A test SSE client (mppx CLI's `mppx.session().sse()` is the obvious candidate).

## Pointers (so future-you doesn't have to grep)

- Reference repo (already cloned): `~/work/random/reference/x402`
- MPP docs (already updated): `.claude/MPP_DOCS.md`
- x402 upto research: `.claude/21_x402-upto-research.md`
- Implementation plan (canonical): `.claude/22_post-work-pricing-plan.md`
- the-stables apps surveyed for backward-compat: `apps/stablememes`, `apps/stablegiftcards`, `apps/stableupload`, `apps/stabledomains`, `apps/stablemerch` (all body-derived, all unaffected).
- INDEX.md updated with entries 21, 22, 23.
