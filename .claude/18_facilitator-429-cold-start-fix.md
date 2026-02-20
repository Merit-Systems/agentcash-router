# Facilitator 429 Cold Start Fix

**Date:** 2026-02-19
**Status:** In progress (pending PR merge)
**Affects:** All services using `@agentcash/router` on Vercel (stablestudio, enrichx402, socialx402, etc.)

## Philosophy

The x402 payment protocol requires a "facilitator" — a Coinbase-hosted service that verifies
and settles on-chain payments. Before handling any paid request, the resource server must call
the facilitator's `/supported` endpoint to learn what payment schemes it supports. This is a
design-time concern, not a runtime one: the answer ("exact scheme on Base mainnet") hasn't
changed since the protocol launched and is unlikely to change without a major version bump.

Treating a static capability check as a per-boot network call is a liability in serverless
environments. When N lambda instances cold-start simultaneously (deploy, idle timeout, traffic
spike), they all call `/supported` at once, get rate-limited, and silently fail — breaking
payment for every route on every instance. The fix eliminates the HTTP call entirely by
hardcoding the response for EVM exact, while preserving the real facilitator for verify/settle
(which are genuinely per-request operations).

## Constraints

- **No Redis required.** Not all downstream services have Redis/Upstash. The fix must be
  zero-dependency.
- **verify() and settle() must remain live.** These are per-transaction calls that must hit
  the real CDP facilitator with auth headers. Only getSupported() is safe to hardcode.
- **EVM exact only.** The hardcoded response covers `exact` on `eip155:8453`. SVM (Solana)
  uses `enhancePaymentRequirements` to extract a `feePayer` from the supported kind — that
  scheme would need the real call. We don't use SVM today.
- **The upstream x402 library is not under our control.** We can't fix
  `x402ResourceServer.initialize()` swallowing errors. We work around it.

## Timeline and Prior Art

### The original problem (Jan–Feb 2026)

Vercel cold starts trigger `server.initialize()` which calls the CDP facilitator's
`/supported` endpoint. When many instances boot simultaneously, CDP rate-limits with 429.
The error manifests as routes returning bare 402 responses with no `PAYMENT-REQUIRED` header
— clients get an unpayable challenge and silently fail.

### enrichx402 PR #56 — "Disable facilitator sync on startup" (merged Feb 5)

First attempt. Disabled `syncFacilitatorOnStart` entirely to avoid 429s. This caused a worse
error: the server never learned what schemes were supported, so every route failed with
`RouteConfigurationError`.

- PR: https://github.com/Merit-Systems/enrichx402/pull/56

### enrichx402 PR #67 — "Add retry logic for facilitator initialization" (open, never merged)

Second attempt. Added retry with exponential backoff around `server.initialize()`. Created
Feb 5, the day before the upstream fix was merged. Left open once the fix was centralized
into `agentcash-router`.

- PR: https://github.com/Merit-Systems/enrichx402/pull/67

### agentcash-router `retryInit()` — centralized retry (shipped, but broken)

The retry logic from enrichx402 PR #67 was moved into `agentcash-router/src/server.ts` as
`retryInit()`. Both stablestudio and enrichx402 consumed it transparently via the
`@agentcash/router` dependency. However, this retry was **dead code** due to Bug #1 (below).

### coinbase/x402 PR #1094 — "Add retry for 429 rate limits in getSupported()" (merged Feb 6)

Upstream fix. Added retry with exponential backoff inside `HTTPFacilitatorClient.getSupported()`
itself. **Not yet published to npm** — latest npm version is `@x402/core@2.3.1` (published
Dec 23, 2025). The fix exists on GitHub `main` but hasn't been released.

- PR: https://github.com/coinbase/x402/pull/1094

### npm gap

As of 2026-02-19, `@x402/core@2.3.1` on npm does **not** contain the retry fix from PR #1094.
The installed version in agentcash-router is `^2.3.0` resolving to `2.3.1`. Even when the
upstream publishes a new version with the retry, it would not fully fix the problem because
`initialize()` still swallows errors (Bug #1).

## The Two Bugs

### Bug 1: `retryInit()` is dead code

`x402ResourceServer.initialize()` (upstream, `@x402/core`) catches and swallows errors from
`getSupported()`:

```typescript
// x402ResourceServer.initialize() — @x402/core
async initialize(): Promise<void> {
    this.supportedResponsesMap.clear();
    this.facilitatorClientsMap.clear();
    for (const facilitatorClient of this.facilitatorClients) {
        try {
            const supported = await facilitatorClient.getSupported();
            // ... populate maps ...
        } catch (error) {
            // BUG: swallowed — logs warning, resolves with empty maps
            console.warn(`Failed to fetch supported kinds from facilitator: ${error}`);
        }
    }
}
```

Because `initialize()` never throws, `retryInit()` always "succeeds" on the first attempt.
The server ends up with empty `supportedResponsesMap` and `facilitatorClientsMap`. No error
is surfaced. `deps.x402Server` is non-null. `deps.x402InitError` is unset. Everything looks
healthy.

### Bug 2: `build402()` returns bare 402 on challenge failure

When `buildX402Challenge()` is called with a server that has empty maps, it calls
`buildPaymentRequirements()` → `getSupportedKind()` on empty maps → throws. The `build402()`
function catches this error, logs it, but returns a 402 response with:
- No `PAYMENT-REQUIRED` header
- Null body
- No payment information whatsoever

Clients receive an unpayable 402. This is the "402 pass-through" seen in production logs.

```typescript
// orchestrate.ts — build402() before fix
} catch (err) {
    // Logged but NOT re-thrown — bare 402 returned
    firePluginHook(deps.plugin, 'onAlert', pluginCtx, { level: 'critical', ... });
}
// Falls through to return bare 402
```

### The full chain

1. Vercel cold start → `getSupported()` gets 429
2. `initialize()` swallows error, resolves with empty maps
3. `retryInit()` sees success, never retries
4. `deps.x402Server` is set (non-null), no `x402InitError`
5. Request arrives → no errors detected → goes to `build402()`
6. `buildX402Challenge()` throws (empty maps) → caught and swallowed
7. Bare 402 with no `PAYMENT-REQUIRED` header → client can't pay

## Why `getSupported()` is unnecessary for EVM exact

The `/supported` endpoint returns:

```json
{
    "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "eip155:8453" }],
    "extensions": [],
    "signers": { "eip155:*": ["0x..."] }
}
```

This data flows into `enhancePaymentRequirements()` on the scheme implementation. For EVM
exact (`@x402/evm`), this method is a **no-op**:

```typescript
// @x402/evm/src/exact/server/scheme.ts
enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys) {
    void supportedKind;   // UNUSED
    void extensionKeys;   // UNUSED
    return Promise.resolve(paymentRequirements); // PASS-THROUGH
}
```

For SVM (Solana), `enhancePaymentRequirements` extracts `feePayer` from `supportedKind.extra`.
We don't use SVM. The `/supported` call is pure overhead and a reliability risk for our
use case.

## The Fix

### Change 1: Hardcode `getSupported()` (`src/server.ts`)

Replace `HTTPFacilitatorClient` with a thin wrapper that:
- Returns a hardcoded `SupportedResponse` for `getSupported()` (no HTTP call)
- Delegates `verify()` and `settle()` to the real `HTTPFacilitatorClient` (with CDP auth)

This eliminates the cold-start HTTP call entirely. `retryInit()` is removed as it's no longer
needed.

### Change 2: Return 500 on challenge build failure (`src/orchestrate.ts`)

The `build402()` catch block now returns a 500 with an actionable error message instead of
a bare 402. This is a safety net for any future failure in the challenge build path (not just
the getSupported issue).

```typescript
// orchestrate.ts — build402() after fix
} catch (err) {
    const message = `x402 challenge build failed: ${err instanceof Error ? err.message : String(err)}`;
    // ... alert ...
    const errorResponse = NextResponse.json({ success: false, error: message }, { status: 500 });
    firePluginResponse(deps, pluginCtx, meta, errorResponse);
    return errorResponse;
}
```

## Testing

### Unit test (`tests/orchestrate.test.ts`)

Added test `"returns 500 when challenge build throws — not a bare 402"`:
- Creates a `FakeX402Server` whose `buildPaymentRequirementsFromOptions` throws (simulating
  empty supported kinds after failed `getSupported`)
- Sends a probe request through the real `createRequestHandler`
- Asserts response is 500, not bare 402

This test was verified to **fail before the fix** (returned 402) and **pass after** (returns 500).

### Integration test (`tests/integration-429.ts`)

End-to-end test against a real 429-ing facilitator:
1. Spins up an HTTP server that returns 429 on `/supported`
2. Creates a real router with real `@x402/core`, `@x402/evm`, `@coinbase/x402`
3. Points the router at the fake facilitator
4. Sends a probe request
5. Verifies the response

**Before fix:** `402`, null body, no headers — the bug.
**After `build402` fix (retry still broken):** `500`, clear error message.
**After hardcoded `getSupported`:** `402` with `PAYMENT-REQUIRED` header — proper payable
challenge, completely unaffected by the 429-ing facilitator.

This test is for manual verification only and should not be included in the CI suite.

### Performance

The `protocols-config.test.ts` test suite (which creates real routers) went from **10.5
seconds** (retrying against the real facilitator with backoff) to **0.5 seconds** after the
fix. This confirms the HTTP calls are eliminated.

## What to watch for

1. **If Coinbase drops `exact` on `eip155:8453`:** This would be a breaking change to the x402
   protocol on Base. Everything would break, not just our hardcoded response. Extremely unlikely
   without advance notice.

2. **If we add SVM (Solana) support:** The hardcoded response only covers EVM exact. SVM's
   `enhancePaymentRequirements` needs real `feePayer` data from the facilitator. We'd need to
   either add a real call for SVM or hardcode its supported kind too (with the feePayer address).

3. **If `x402Version` bumps to 3:** The hardcoded response specifies `x402Version: 2`. A major
   protocol version bump would require updating the hardcoded response. This would also require
   code changes throughout the stack.

4. **If upstream fixes `initialize()` error swallowing:** If `@x402/core` changes `initialize()`
   to propagate `getSupported()` errors, the retry logic would start working. But since we've
   eliminated the call entirely, this is moot for EVM exact.

5. **`verify()` and `settle()` still hit CDP:** If the facilitator is down at request time,
   individual payment verifications/settlements will fail. This is correct behavior — those are
   genuinely per-transaction and can't be hardcoded. The failure is visible (500 on settlement)
   and affects individual transactions, not all routes globally.

## Files changed

| File | Change |
|------|--------|
| `src/server.ts` | Replace `HTTPFacilitatorClient` + `retryInit()` with `cachedClient()` wrapper that hardcodes `getSupported()` |
| `src/orchestrate.ts` | `build402()` catch returns 500 instead of bare 402 |
| `tests/orchestrate.test.ts` | New test for challenge build failure |
| `tests/integration-429.ts` | Manual integration test (do not ship to CI) |
