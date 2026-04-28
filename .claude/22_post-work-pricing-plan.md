# 22. Post-work pricing — implementation plan (x402 `upto` + MPP sessions)

**Status:** Phase 1 implemented for both protocols. x402 `upto` ships unchanged from the original plan. MPP support uses `tempo.session` + SSE rather than `tempo.charge`, because pull-mode `charge` can't honor a post-work amount override (the signed Tempo transaction commits the client to a specific amount before the handler runs — empirically confirmed; see "MPP via sessions" section below).
**Companion:** `21_x402-upto-research.md` (how x402 upstream implements `upto`)

## Problem

Two real use cases the router can't serve today:

1. **Variable single-charge.** "Run an LLM call, charge based on actual tokens used, capped at $0.10." Price is unknown until the handler is mostly done. Today the router resolves the dynamic price from the request body **before** invoking the handler and locks that price into both the 402 challenge and the eventual `settlePayment` call.
2. **Per-unit streaming.** "Stream a poem word-by-word at $0.001/word; if the channel runs dry mid-stream, prompt for a new voucher." Native shape on MPP sessions; not expressible at all on x402 today.

These are two different control-flow shapes, but to a route author they're variations of the same theme: *the handler decides what gets charged*. We should expose them as a coherent pair of route-builder methods that together cover post-work pricing across both protocols, today and as the protocol space evolves.

## Guiding principle

> The route author doesn't think about `upto` vs `exact`, `charge` vs `session`. They declare what they're billing for; the orchestrate pipeline picks the right wire mechanism per registered protocol and rejects the route at registration if no protocol can serve it.

This matches the existing router stance: protocol logic lives in `src/protocols/*` and `src/orchestrate.ts`, route builders express intent.

## Phase 1 — `upto`-style variable single-charge (do this now)

### Public API

```ts
// New shape: `.paid()` accepts an upper-bound spec; handler reports actual.
router
  .route('llm/generate')
  .paid({ maxPrice: '0.10', variable: true })  // ceiling, contract-enforced
  .body(GenerateSchema)
  .handler(async ({ body, payment }) => {
    const result = await runModel(body);
    payment.setAmount(result.usdCost);   // <= '0.10'; '0' allowed → no charge
    return result;
  });
```

The signature: `payment.setAmount(amount: string)` accepts the same three formats x402's `SettlementOverrides` accepts (raw atomic, `"50%"`, `"$0.05"`). Default form is decimal dollars (`'0.07'`) to match `.paid('0.07')` elsewhere — we normalize internally to whichever shape the protocol needs.

`maxPrice` is **required** when `variable: true`. Without it there's no ceiling for the 402 challenge.

If the handler returns without calling `setAmount()`, we settle for `maxPrice` (preserves today's behavior — the caller is making an upper-bound payment and the work was done).

### Why a method on `payment` rather than a return-value shape?

- **Symmetry with the future tick API** (`payment.tick()` for sessions). Same object, two methods.
- **Independent of the handler's return value.** The handler might still want to return a streaming response, throw, etc.
- **Discoverable on the typed context.** `ctx.payment.setAmount` shows up in editors next to `ctx.payment.payer` and friends.

### Wire changes

1. **`HandlerContext.payment`** gains `setAmount(amount: string): void`.
   - When the route isn't `paid`, `payment` is `null` as it is today.
   - When the route is paid but the protocol can't honor an override (e.g. plain `exact`), calling it throws synchronously from inside the handler so the bug is loud.
2. **`RouteEntry`** gains `variablePrice?: boolean`.
3. **`PaidOptions`** in `src/types.ts:157` accepts `{ variable?: boolean }`.
4. **`builder.ts` `.paid()`** validates: `variable: true` requires `maxPrice` and is incompatible with the tiered pricing object.
5. **Registration-time validation** (in `src/index.ts` `route()` factory or `builder.ts`): if the route is `variable`, every configured protocol on that route must support post-work amount override. For x402 that means there must be a registered `upto` accept on at least one network. We'd surface a clear error on `pnpm build`/registration if `accepts: [{ scheme: 'exact', ... }]` is the only x402 entry for a `variable` route.
6. **`orchestrate.ts` capture & thread:**
   - Build a closure-scoped `override = { amount?: string }` per request.
   - Inject `setAmount` into `ctx.payment` that writes into it.
   - After the handler succeeds, pass `override.amount` into a new `overrides` argument on `settleX402Payment`.
7. **`settleX402Payment` (`src/protocols/x402.ts:387`)** gains an optional `overrides?: { amount?: string }` and forwards it as the 5th arg to `server.settlePayment(...)` per upstream's signature (`x402ResourceServer.ts:894`).
8. **402 challenge generation** stays unchanged — for `variable` routes the challenge price is `maxPrice` (we already have this branch in `build402` at `src/orchestrate.ts:1283-1285`; we just always take it when `variablePrice` is set).
9. **Bazaar input/output schema embedding** stays unchanged.

### Behavior matrix

| Path | What happens |
|---|---|
| Handler returns, no `setAmount` call | Settle at `maxPrice`. (Today's behavior preserved.) |
| Handler calls `setAmount('0.07')` | Settle at $0.07. Resolved via `resolveSettlementOverrideAmount` upstream. |
| Handler calls `setAmount('0')` | Skip on-chain settle entirely. `0` is legal upstream and the contract treats it as a no-op. We still emit `Payment-Response` header with `amount: '0'` and treat the auth as consumed. |
| Handler calls `setAmount('0.50')` when `maxPrice: '0.10'` | Throw a 4xx from settle (facilitator returns `invalid_upto_evm_payload_settlement_exceeds_amount`). We surface as `500 Settlement failed` with the upstream error string, just like today. The contract is the actual ceiling — we don't need to second-guess it client-side, but we *should* clamp + log a `warn` plugin alert for operator visibility. |
| Handler calls `setAmount` twice | Last call wins. |
| Handler throws | Skip settle entirely. `setAmount` is irrelevant. (Today's behavior.) |

### MPP via sessions (corrects the original "free pull-mode override" claim)

The original plan optimistically asserted that `mppx.charge({ amount: override })` would honor a post-work amount on pull-mode (transaction-payload). That was wrong. mppx's `Charge.js` `transaction` branch deserializes the signed Tempo tx and calls `assertTransferCalls` / `FeePayer.validateCalls` against the `amount` arg — if the signed amount and the `charge()` arg differ, mppx rejects with `MismatchError` ("credential amount does not match this route's requirements"). Empirically reproduced against the live fortune route (TX `0xb0...4a83` for $0.05 went through; `setAmount('$0.034')` against the same maxPrice signed credential produced a 500 with the mismatch error).

Why: pull-mode signs a *final* transaction with a specific amount. The amount is in the bytes the signature commits to. The server can either broadcast what the client signed or reject; it can't broadcast a different amount.

The MPP analog of x402 `upto` is the **session** intent. A session opens a payment-channel deposit (escrow), the client signs cumulative-amount vouchers off-chain, and the server settles for the actual cumulative — unused deposit auto-refunds. To get the post-work amount onto a signed voucher, the server needs the client to sign a fresh voucher *after* the handler decides the amount, which is bidirectional. mppx supports this via SSE: after handler, the server's SSE generator calls `stream.charge()` per tick; mppx auto-cycles vouchers via `event: payment-need-voucher` if the channel runs short.

**Wire shape — how variable + MPP routes flow today**

1. `RouterConfig.mpp.session = { tickCost, unitType }` opts the router into session support. We wire `tempo.session({ sse: true, account, currency, recipient, store })` alongside `tempo.charge` in `Mppx.create({ methods })` (`src/index.ts`).
2. `build402` for variable + MPP routes issues a session challenge: `mppx.session({ amount: tickCost, unitType, suggestedDeposit: maxPrice })(request)`. The 402 advertises `intent="session"` with the canonical Tempo escrow contract.
3. Request handler distinguishes session credentials via `payload.action ∈ {open, voucher, topUp, close}` (vs charge's `payload.type ∈ {transaction, hash}`):
   - **management actions** (close, topUp, bodyless open/voucher) → mppx's `respond` hook returns 204; we pass through.
   - **content actions** (voucher with body, GET retries) → run handler, build async generator that calls `stream.charge()` `ceil(actualAmount / tickCost)` times then yields the response body, hand it to `result.withReceipt(generator)`. mppx auto-converts to SSE.
4. Charge credentials arriving at variable routes are rejected with 400 + warn alert (the route advertises sessions, not charge — only misbehaving clients hit this).

**Why we set `tickCost` instead of using a single dynamic charge**

mppx's `SessionController.charge()` reserves a fixed `tickCost` per call (set on the session method's `amount` config and forwarded via the credential's `request.amount`). To charge an arbitrary post-work amount we tick `N` times where `N = ceil(actualAmount / tickCost)`. With `tickCost: '0.0001'` (one hundredth of a cent), a $0.05 max admits up to 500 ticks per request — comfortable headroom and 4-decimal precision. Slightly chatty server-side but uses only the documented public API. If mppx exposes a single-call variable-amount method later, the helper that translates `effectiveAmount` to N ticks is the only piece that changes.

### Tests (mirror `tests/upto-scheme.test.ts`)

x402 upto:
- handler calls `setAmount('0.05')` → settled requirements.amount === atomic('0.05')
- handler calls `setAmount('0')` → no settle facilitator call, response still 200, `payment.transaction === ''`
- handler doesn't call setAmount → settled at maxPrice
- handler calls setAmount twice → last call wins
- registration: `variable: true` without `maxPrice` throws
- registration: `variable: true` with only `exact` x402 accepts throws

variable + MPP:
- session voucher credential with body → SSE response, charge() called N=actualAmount/tickCost times
- session voucher credential, no setAmount → charge() called N=maxPrice/tickCost times
- session close/topUp/bodyless open/voucher → 204 management ack, handler not invoked
- no credential → 402 advertising session intent
- pull-mode charge credential (transaction) on variable route → 400 reject with "session credential required"
- push-mode charge credential (hash) on variable route → 400 reject with "session credential required"
- session credential without `mpp.session` configured → 500 with "session not configured"

### Code locations to touch (Phase 1)

- `src/types.ts` — `HandlerPaymentContext`, `HandlerContext.payment`, `PaidOptions`, `RouteEntry`
- `src/builder.ts` — `.paid()` accepts `{ variable }`, validates required `maxPrice`
- `src/index.ts` (or wherever `createRouter` validates routes) — registration-time check that `variable: true` requires `maxPrice` and (when x402 is enabled) at least one `upto` accept
- `src/orchestrate.ts` — closure-scoped override, ctx.payment.setAmount injection, threading into x402 + MPP charge calls; runtime 400 + plugin warn when a `variable` route receives a push-mode (hash-payload) MPP credential
- `src/protocols/x402.ts` — `settleX402Payment` accepts `overrides`
- New: `tests/post-work-pricing.test.ts`
- Changeset: `.changeset/post-work-pricing.md`

## Phase 2 — MPP sessions for streaming (future, design-only here)

This phase is **not** in scope for the first PR but the API must accommodate it now so we don't paint ourselves into a corner.

### Public API

```ts
router
  .route('poem/stream')
  .session({ perUnit: '0.001', unitType: 'word', maxPrice: '1.00' })
  .handler(async ({ payment }) => {
    return async function* () {
      yield JSON.stringify({ title, author });
      for (const word of words) {
        await payment.tick();   // one voucher charge
        yield word;
      }
    };
  });
```

`payment.tick(units?)` — defaults to 1 unit. Returns a `Promise<void>` that resolves once the voucher is signed/accepted (or rejects if the channel is dry and the client gives up).

### Why a separate `.session()` builder method (not an extra flag on `.paid()`)

- Different control-flow shape entirely (handler returns an async generator, not a value).
- Different SDK plumbing on the wire (`mppx.session({ amount, unitType })` returns a middleware that wants the handler-as-async-iterable).
- `unitType` is meaningful only for streaming — putting it on `.paid()` muddles the type.
- Today MPP is the only protocol that natively supports this shape; `.session()` is a clear "you need MPP and SSE on the route."

### Wire (sketch, when we get there)

- `RouteEntry.sessionConfig?: { perUnit, unitType, maxPrice? }` plus a flag.
- `.session()` forces `protocols: ['mpp']` (or rejects routes that include `x402`).
- `orchestrate.ts` adds a third top-level branch (next to `paid` and `siwx`): **session**.
  - Reads MPP credential, calls `deps.mppx.session({ amount: perUnit, unitType })(request)` — that returns the same `{ status, withReceipt }` envelope as `mppx.charge` but the receipt-side accepts an `async function* (stream)` and exposes `stream.charge()` / `stream.tick()`.
  - We adapt: our `payment.tick()` proxies to `stream.charge()`. Handler returns an async generator; orchestrate yields it through `withReceipt`.
- 402 challenge surfaces both the `Settlement-Overrides`-style fields and the session-specific fields (`unitType`, suggested deposit). MPP's charge handles this for us via mppx's session middleware — we just call it and forward the WWW-Authenticate.
- Discovery / Bazaar: emit a per-unit price hint plus `streaming: true`.
- Out-of-band closure: not our concern in the route — the client's mppx instance handles channel close.

### Why Phase 1 doesn't lock us out of Phase 2

- `payment.setAmount(amount)` and `payment.tick(units?)` are orthogonal methods. They never appear on the same route, but they share the `payment` object cleanly.
- `.paid({ variable })` and `.session({ perUnit })` are sibling builder methods; neither implies a schema change in the other.
- The closure-scoped "override carrier" we add in Phase 1 (`{ amount?: string }`) generalizes to a `meter` object in Phase 2 (`{ ticks: number, units: string }`). Same plumbing pattern: handler mutates state, orchestrate reads it post-handler.

### What we'd revisit at Phase 2 time

- Whether `.session()` should be the only way to do streaming, or whether `.paid({ variable })` plus an async-generator return value should also be supported on MPP-only routes (probably no — keep them distinct).
- Whether x402 `upto` can serve the streaming case by accumulating `payment.tick()` calls and settling once at the end. Possible but not interesting until we have a real client that wants to switch protocols transparently. Punt.
- SIWX-acceleration on session routes — likely "not supported", because each request is metered individually.

## Risks and open questions (Phase 1)

1. **Cap clamping vs trust the contract.** I argue we should *not* pre-validate `setAmount(x)` against `maxPrice` — let the facilitator/contract reject. Reason: the override format includes percent and dollar strings; resolving them client-side duplicates work and risks divergence with upstream. Just plumb the raw string through. We *should* warn in the plugin alert when the upstream rejects with `invalid_upto_evm_payload_settlement_exceeds_amount` so operators see misuse quickly.

2. **`setAmount('0')` UX.** It's protocol-legal and useful (e.g. "we matched a cached result, don't charge"). But our SIWX-entitlement code path (`src/orchestrate.ts:756-766`) currently grants entitlement on any successful settlement — should a `0` settle still grant? I'd say **no**: entitlement should require an actual paid request. Add a guard `if (effectiveAmount > 0) await deps.entitlementStore.grant(...)`.

3. **`maxPrice` semantics drift.** Today `maxPrice` is "safety net + fallback for body-derived pricing". For variable routes it becomes "the contract-enforced ceiling." Same field, slightly different meaning. Reasonable to overload — adding `variable: true` is an explicit opt-in.

4. **Plugin / observability.** `onPaymentSettled` should report the *effective* amount, not the originally-quoted one. Same field name (`amount`), different value. Ensure that's clear in the plugin docs we update with this PR.

5. **Cancellation.** If the client disconnects after the handler ran but before settle, do we still settle? Today: yes, settlement happens even after `request.signal.aborted`. With `setAmount('0')` we get a free-ish "user bailed, don't charge" by detecting `signal.aborted` and overriding to 0 ourselves. Marginally useful. Keep out of scope for Phase 1; document.

## Recommended next step

Implement Phase 1 as a single PR. Keep the changeset to `minor` (additive: new `.paid({ variable })` shape, no breaking changes). Don't ship `.session()` in the same PR — it'll need its own design pass once we look at how mppx's session middleware composes with our orchestrate split between SIWX/auth/payment.

Suggested commit shape:
1. `feat(types): add variablePrice and payment.setAmount`
2. `feat(orchestrate): thread settlement override through x402 + mpp charge`
3. `feat(builder): .paid({ variable }) shape with registration-time validation`
4. `test(post-work-pricing): cover override paths for x402 upto and mpp charge`
5. `docs(claude): mark this plan as in-progress, add CLAUDE.md note on .paid({ variable })`
