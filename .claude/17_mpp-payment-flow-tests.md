# MPP Payment Flow Tests

**Date:** 2026-02-16
**Status:** In Progress
**Target:** v0.4.2
**Context:** MPP payments work end-to-end in production (validated on enrichx402.com) but have zero test coverage for the payment flow. x402 has good coverage in `tests/orchestrate.test.ts` — MPP needs parity.

---

## Philosophy

**Test at the orchestrate boundary, not deeper.** The x402 tests mock the protocol module (`src/protocols/x402.js`) and test the full request handler flow through `createRequestHandler()`. MPP tests follow the same pattern — mock `src/protocols/mpp.js`, not the mpay library internals.

**Why this level:**
- Tests the real orchestrate pipeline (lines 354-390)
- Catches integration bugs (header handling, wallet normalization, receipt attachment)
- Avoids coupling to mpay library internals (Challenge.fromIntent, Credential.fromRequest)
- Matches x402 test structure for consistency

**What we're NOT testing:**
- `buildMPPChallenge` internals (mpay's Challenge.fromIntent behavior)
- `verifyMPPCredential` internals (Tempo RPC verification)
- mpay library correctness (that's their job)

---

## Constraints

1. **Single file addition.** Add a `describe('MPP paid route')` block to `tests/orchestrate.test.ts` alongside the existing `describe('x402 paid route')` block. No new test files unless the mocking doesn't fit.

2. **Mock at the same boundary as x402.** The x402 tests mock `../src/protocols/x402.js`. MPP tests mock `../src/protocols/mpp.js` the same way.

3. **~5 tests total.** Mirror the x402 test cases:
   - Probe → 402 with challenge header
   - Valid credential → 200 with receipt header
   - Invalid credential → 402 re-challenge
   - Handler error → no receipt
   - Wallet set on context

4. **Use existing test infrastructure.** Leverage `makeDeps()`, `makeEntry()`, and the request helper patterns. Add MPP-specific variants.

5. **mppConfig required in deps.** The orchestrate pipeline (line 356) checks `if (!deps.mppConfig)` before entering the MPP path. Tests must provide this.

---

## Mocking Strategy

### Mock Definition

```typescript
vi.mock('../src/protocols/mpp.js', () => ({
  buildMPPChallenge: async () => 'MOCK_MPP_CHALLENGE',

  verifyMPPCredential: async (request: Request) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Payment ')) return null;

    try {
      const payload = JSON.parse(Buffer.from(auth.slice(8), 'base64').toString());
      if (payload.payer === KNOWN_MPP_PAYER) {
        return { valid: true, payer: payload.payer, txHash: '0xMOCK_TX' };
      }
      return { valid: false, payer: null };
    } catch {
      return null;
    }
  },

  buildMPPReceipt: () => 'MOCK_MPP_RECEIPT',
}));
```

### Why This Shape

- **buildMPPChallenge:** Returns a string (the challenge is set directly to `WWW-Authenticate` header at orchestrate.ts:604-605)
- **verifyMPPCredential:** Returns `{ valid: true, payer, txHash }` or `{ valid: false, payer: null }` or `null` (matching the real signature)
- **buildMPPReceipt:** Returns a string (set to `Payment-Receipt` header at orchestrate.ts:382)

The mock parses a fake `Authorization: Payment <base64>` header where the payload contains `{ payer: string }`. This mirrors how the real credential works but skips HMAC/Tempo verification.

---

## Test Helpers

### Constants

```typescript
const KNOWN_MPP_PAYER = '0xMPP_PAYER_1234567890';
```

### makeMPPDeps

```typescript
function makeMPPDeps(overrides: Partial<OrchestrateDeps> = {}): OrchestrateDeps {
  return {
    x402Server: null,  // MPP doesn't use x402 server
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    payeeAddress: KNOWN_PAYEE,
    network: 'tempo:42431',
    mppConfig: {
      secretKey: 'test-secret',
      currency: '0xUSDC',
      recipient: '0xRECIPIENT',
    },
    ...overrides,
  };
}
```

### makeMPPEntry

```typescript
function makeMPPEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/mpp-route',
    authMode: 'paid',
    pricing: '0.02',
    protocols: ['mpp'],
    method: 'POST',
    ...overrides,
  };
}
```

### withMPPPayment

```typescript
function withMPPPayment(options: { payer?: string; body?: unknown } = {}): NextRequest {
  const credential = Buffer.from(
    JSON.stringify({ payer: options.payer ?? KNOWN_MPP_PAYER })
  ).toString('base64');

  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { Authorization: `Payment ${credential}` },
    ...(options.body && { body: JSON.stringify(options.body) }),
  });
}
```

---

## Test Cases

### 1. Probe returns 402 with WWW-Authenticate header

**Route:** `{ protocols: ['mpp'], pricing: '0.02' }`
**Deps:** `makeMPPDeps()`
**Request:** `makeProbeRequest()` (no Authorization header)
**Assert:**
- `res.status === 402`
- `res.headers.get('WWW-Authenticate')` is truthy

**Validates:** orchestrate.ts:602-615 (build402 sets WWW-Authenticate for MPP routes)

### 2. Valid MPP credential returns 200 with Payment-Receipt header

**Route:** `{ protocols: ['mpp'], pricing: '0.02', bodySchema }`
**Deps:** `makeMPPDeps()`
**Request:** `withMPPPayment({ body: { query: 'test' } })`
**Assert:**
- `res.status === 200`
- `res.headers.get('Payment-Receipt')` is truthy
- Response body contains handler result

**Validates:** orchestrate.ts:354-390 (full MPP payment flow + receipt attachment)

### 3. Invalid MPP credential returns 402

**Route:** `{ protocols: ['mpp'], pricing: '0.02', bodySchema }`
**Deps:** `makeMPPDeps()`
**Request:** `withMPPPayment({ payer: 'BAD_PAYER', body: { query: 'test' } })`
**Assert:**
- `res.status === 402`

**Validates:** orchestrate.ts:359 (`if (!verify?.valid) return await build402(...)`)

### 4. Handler error skips receipt generation

**Route:** `{ protocols: ['mpp'], pricing: '0.02', bodySchema }`
**Handler:** `async () => { throw new Error('Handler boom'); }`
**Deps:** `makeMPPDeps()`
**Request:** `withMPPPayment({ body: { query: 'test' } })`
**Assert:**
- `res.status === 500`
- `res.headers.get('Payment-Receipt')` is null

**Validates:** orchestrate.ts:380 (`if (response.status < 400)` gate before receipt)

### 5. Wallet is set on handler context from verified payer

**Route:** `{ protocols: ['mpp'], pricing: '0.02', bodySchema }`
**Handler:** Captures `ctx.wallet`
**Deps:** `makeMPPDeps()`
**Request:** `withMPPPayment({ body: { query: 'test' } })`
**Assert:**
- `capturedWallet === KNOWN_MPP_PAYER.toLowerCase()`

**Validates:** orchestrate.ts:362 (`wallet = verify.payer!.toLowerCase()`)

---

## Implementation Checklist

- [ ] Add vi.mock for `../src/protocols/mpp.js` (after existing x402 mock)
- [ ] Add `KNOWN_MPP_PAYER` constant
- [ ] Add `makeMPPDeps()` helper
- [ ] Add `makeMPPEntry()` helper
- [ ] Add `withMPPPayment()` helper
- [ ] Add `describe('MPP paid route')` block with 5 tests
- [ ] Run `pnpm test` to verify all pass
- [ ] Run `pnpm check` to verify no lint/type errors

---

## Non-Goals

- **Don't test MPP challenge generation internals.** That's mpay library's responsibility.
- **Don't test Tempo RPC verification.** That requires real network calls.
- **Don't add fakes to `tests/fakes/`.** The mock is simple enough to inline.
- **Don't create a separate test file.** This belongs with orchestrate tests.
- **Don't test dual-protocol (x402 + mpp) routes.** That's a separate concern.

---

## References

- **x402 tests:** `tests/orchestrate.test.ts:205-287` (describe('x402 paid route'))
- **MPP implementation:** `src/protocols/mpp.ts`
- **Orchestrate MPP path:** `src/orchestrate.ts:354-390`
- **Protocol detection:** `src/protocols/detect.ts:9-12`
- **Body consumption bug:** `tests/mpp-body-bug.test.ts` (regression test)
- **MPP deep dive:** `.claude/16_mpp-deep-dive.md`
