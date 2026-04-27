# 21. x402 `upto` scheme — research notes

**Status:** Research complete. Implementation plan in `22_post-work-pricing-plan.md`.
**Reference:** `~/work/random/reference/x402` (cloned from `github.com/x402-foundation/x402`)

## Why we care

We want a route whose price is determined **after the handler does work** (e.g. an LLM call where you only know token cost after generation, or a search that finds a variable number of results). Today `@agentcash/router` resolves the dynamic price from the request body **before** the handler runs and locks that price into both the 402 challenge and the eventual settlement call. That's fine for "price is a function of body" but not for "price is a function of work performed."

x402's `upto` scheme exists to solve exactly this. This doc captures how it works upstream so we can wire an analogue into the router cleanly.

## Spec summary (`specs/schemes/upto/scheme_upto.md`)

`upto` authorizes a transfer of **up to a maximum amount** from client to server. The actual amount is set at settlement time based on what the resource consumed.

Five MUSTs:
1. **Single-use** — each authorization settles at most once (Permit2 nonce on EVM).
2. **Time-bound** — `validAfter` + `deadline` on the authorization.
3. **Recipient-bound** — facilitator can't redirect funds; recipient is in the witness.
4. **Settled ≤ max** — settlement amount must be ≤ authorized max; MAY be `0`.
5. **Phase-dependent `amount`** — the same `PaymentRequirements.amount` field means **maximum** at verify time and **actual** at settle time. The resource server communicates the chosen amount to the facilitator by mutating `requirements.amount` before calling `settlePayment`.

Out of scope for `upto`: streaming/multi-settlement, recurring payments, open-ended allowances. Those are session/channel territory.

EVM-specific (`specs/schemes/upto/scheme_upto_evm.md`):
- Uses Permit2 `permitWitnessTransferFrom` exclusively. EIP-3009 cannot work because it locks an exact amount at signature time.
- A new contract `x402UptoPermit2Proxy` deployed at `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` handles the variable-amount settle. Its witness includes a `facilitator` field for access control.
- Approval still has the three flavors used for `exact` (direct, sponsored ERC20, EIP-2612). Approval extensions are reused unchanged.
- Phase 4 settlement: `x402Permit2Proxy.settle(permit, actualAmount, owner, witness, signature)` where `actualAmount <= permit.permitted.amount`.
- Zero settlement (`amount = 0`) is on-chain a no-op — no transaction, authorization simply expires.
- Scheme-specific error code: `invalid_upto_evm_payload_settlement_exceeds_amount`.

## TypeScript implementation

Three layers, all needed:

### Layer 1 — `UptoEvmScheme` (mechanisms/evm/src/upto/server/scheme.ts)

The scheme server class. We already register this in `src/server.ts:36-39`. Two methods we lean on:

- `parsePrice(price, network) → AssetAmount` — converts `'0.10'` (or `{ amount, asset }`) to atomic units with the right decimals.
- `getAssetDecimals(_asset, network) → number` — returns the default-asset decimals (6 for USDC). Used by the override resolver below to interpret `"$0.05"` strings.

The class is a regular `SchemeNetworkServer` — it's not what carries the post-handler amount. That happens at layer 2.

### Layer 2 — `x402ResourceServer.settlePayment(..., settlementOverrides)` (core/src/server/x402ResourceServer.ts:894)

Existing signature in upstream:

```ts
async settlePayment(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
  declaredExtensions?: Record<string, unknown>,
  transportContext?: unknown,
  settlementOverrides?: SettlementOverrides,
): Promise<SettleResponse>
```

`SettlementOverrides`:

```ts
interface SettlementOverrides {
  /** Raw atomic ('1000') | percent ('50%') | dollar ('$0.05') */
  amount?: string;
}
```

When `overrides.amount` is set, `settlePayment` clones `requirements`, runs `resolveSettlementOverrideAmount(rawAmount, requirements, decimals)` (core/src/server/x402ResourceServer.ts:157) to convert the override to atomic units, and passes the resulting `effectiveRequirements` to the facilitator. **This is the only mutation between verify and settle.**

The override format is a single string with three accepted shapes:
- `"1000"` — raw atomic units (passed through).
- `"50%"` — percent of `requirements.amount`. Floor to atomic.
- `"$0.05"` — dollar amount; converted via the registered scheme's `getAssetDecimals` (default 6).

Per-scheme registered `SchemeNetworkServer.getAssetDecimals` is what makes the dollar form work for upto without us hardcoding 6.

### Layer 3 — HTTP integrations carry the override out-of-band

The middleware-style packages (`packages/http/express`, `hono`, `fastify`) expose `setSettlementOverrides(res, { amount })`. It writes a JSON-serialized header named `Settlement-Overrides` (constant: `SETTLEMENT_OVERRIDES_HEADER`, defined in `core/src/http/x402HTTPResourceServer.ts:19`) on the outgoing response.

The middleware buffers the response (intercepting `res.write`/`res.end`/`res.writeHead`), then before flushing to the client:
1. Reads response headers.
2. Looks for `Settlement-Overrides` (case-insensitive), JSON-parses it.
3. Calls `processSettlement(payload, requirements, declaredExtensions, { request, responseHeaders }, overrides?)` — explicit `overrides` argument wins over the header (see core/src/http/x402HTTPResourceServer.ts:619-633).
4. Strips the `Settlement-Overrides` header before forwarding to the client.

This out-of-band header trick exists because Express/Hono/Fastify don't naturally hand the route handler a settle-time hook — the middleware runs *around* the handler and can only see what the handler put on the response object.

In our world (`@agentcash/router`'s orchestrate.ts) we don't have that limitation — we control the handler invocation directly and can put a real method on `HandlerContext`.

## End-to-end flow (today, upstream)

1. Client `POST /api/foo`.
2. Server returns 402 with `accepts: [{ scheme: 'upto', amount: '5000000', ... }]`. The `5000000` is the **max** in atomic units.
3. Client signs Permit2 authorization for max, retries with `X-PAYMENT` / `PAYMENT-SIGNATURE` header.
4. `verifyPayment(payload, requirements)` — checks signature, deadline, balance, allowance. Returns `{ isValid, payer }`.
5. Handler runs. At any point it calls `setSettlementOverrides(res, { amount: '$0.07' })` (Express) or returns the override another way.
6. Middleware reads header, calls `settlePayment(payload, requirements, _, _, { amount: '$0.07' })`.
7. `settlePayment` resolves `'$0.07'` → `70000` atomic, clones requirements with `amount: '70000'`, calls facilitator's `settle`.
8. Facilitator submits `x402Permit2Proxy.settle(permit, 70000, ...)`. Contract enforces `70000 <= permit.permitted.amount` (`5000000`).
9. `Payment-Response` header on the 200 carries the actual settled amount.

Key invariants we'd inherit:
- The server holds all trust here. The contract enforces the cap, but the *choice* of how much to charge is fully server-side. Our handler / settlement override can be 0 ("no charge") or anything ≤ max.
- A 0 settlement skips the on-chain transaction entirely. Useful for "the work failed, don't charge" — we can drop this in cleanly to our existing "handler returned status≥400 → skip settlement" path, except now we'd also support "handler succeeded but found nothing → settle for 0".

## What's already wired in `@agentcash/router` and what isn't

Already there:
- `UptoEvmScheme` is registered for every EVM network in `src/server.ts:36-39`.
- `upto` accepts in `RouterConfig.x402.accepts` validate (must have `asset` for non-`exact` schemes).
- `tests/upto-scheme.test.ts` covers config validation, challenge inclusion, and that the verify→settle round trip with the `upto` scheme works through the orchestrate pipeline.

Missing:
- No way for the handler to communicate "settle for X". `src/orchestrate.ts:744-749` calls `settleX402Payment(server, verifyPayload, verifyRequirements)` with no override path. `src/protocols/x402.ts:387-398`'s `settleX402Payment` doesn't accept overrides either.
- `HandlerContext` has no settlement-override surface (`src/types.ts:235-246`).
- The `payment` field on `HandlerContext` is read-only metadata — `payer`, `amount`, `network`, etc.

Adding the wire is small. The interesting question is the API surface, since we want it to also serve MPP sessions.

## Pointers

- Spec: `specs/schemes/upto/scheme_upto.md`, `specs/schemes/upto/scheme_upto_evm.md`
- Scheme server: `typescript/packages/mechanisms/evm/src/upto/server/scheme.ts`
- Facilitator: `typescript/packages/mechanisms/evm/src/upto/facilitator/`
- Settle override resolver: `typescript/packages/core/src/server/x402ResourceServer.ts:157` (`resolveSettlementOverrideAmount`)
- `settlePayment` override branch: `typescript/packages/core/src/server/x402ResourceServer.ts:894-918`
- HTTP header constant: `typescript/packages/core/src/http/x402HTTPResourceServer.ts:19`
- `setSettlementOverrides` for Express: `typescript/packages/http/express/src/index.ts:26`
- Header-extraction in HTTP middleware: `typescript/packages/core/src/http/x402HTTPResourceServer.ts:619-633`
- Integration tests demonstrating partial settle: `typescript/packages/core/test/integrations/upto.test.ts`
