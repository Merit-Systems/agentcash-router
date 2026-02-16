# Fixing MPP Support in @agentcash/router

**Date:** 2026-02-15
**Status:** Resolved in v0.4.1
**Priority:** P0 - Critical

---

## Current Status

### Fixed Issues ✅
1. ✅ **Challenge generation bug**: Router was passing HTTP Request object instead of payment data to `Challenge.fromIntent()` - FIXED in commit 6f3bbf2
2. ✅ **Currency format**: enrichx402 uses PathUSD address `0x20c0000000000000000000000000000000000000` - FIXED
3. ✅ **Decimals**: Added explicit `decimals: 6` to challenge request - FIXED
4. ✅ **NextRequest vs Request**: Added `toStandardRequest()` to convert NextRequest to standard Request - FIXED
5. ✅ **Body stream consumption bug**: Removed body from `toStandardRequest()` since body is consumed before MPP verification - FIXED (see below)

### Resolved Issue
**MPP credential verification was failing because `toStandardRequest()` tried to copy the body stream after it was already consumed by `parseBody()` in orchestrate.ts.**

---

## Root Cause: NextRequest vs Request Type Mismatch

### The Problem

`agentcash-router` passes `NextRequest` to mpay, but **mpay expects standard Web API `Request`**.

### Working Implementation (any-pay-server)

```typescript
// Next.js App Router route handlers receive standard Request
export async function GET(request: Request) {  // ← Standard Web API Request
  const r = await mpay.charge({ amount })(request);  // ✅ Works perfectly
  if (r.status === 402) return r.challenge;
  return r.withReceipt(Response.json(body));
}
```

### Broken Implementation (agentcash-router)

```typescript
// src/orchestrate.ts (lines 102, 353)
export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: (ctx: HandlerContext) => Promise<unknown>,
  deps: OrchestrateDeps,
): (request: NextRequest) => Promise<NextResponse> {  // ← NextRequest
  return async (request: NextRequest): Promise<NextResponse> => {
    // ...
    const verify = await verifyMPPCredential(request, routeEntry, deps.mppConfig, price);
    //                                       ↑ Passing NextRequest to mpay
  }
}

// src/protocols/mpp.ts (line 61, 98)
export async function verifyMPPCredential(
  request: Request,  // ← Type says Request, but receives NextRequest at runtime
  _routeEntry: RouteEntry,
  mppConfig: { secretKey: string; currency: string; recipient?: string },
  price: string,
) {
  // ...
  credential = Credential.fromRequest(request);  // ❌ mpay can't parse NextRequest headers
}
```

### Why It Fails

1. **TypeScript allows it**: `NextRequest extends Request`, so the type system doesn't catch the issue
2. **Runtime incompatibility**: `NextRequest` has subtle header handling differences that break mpay's parsing
3. **mpay expects standard behavior**: `Credential.fromRequest()` expects standard Web API `Request.headers.get()` behavior
4. **Result**: `Credential.fromRequest()` fails to extract the credential and returns `undefined`

### Evidence from mpay Source

```javascript
// node_modules/mpay/dist/Credential.js
export function fromRequest(request) {
    const header = request.headers.get('Authorization');  // ← Expects standard Request
    if (!header)
        throw new Error('Missing Authorization header.');
    const payment = extractPaymentScheme(header);
    if (!payment)
        throw new Error('Missing Payment scheme.');
    return deserialize(payment);
}
```

### Why any-pay-server Works

Next.js App Router route handlers (`app/api/*/route.ts`) receive **standard Web API `Request` objects**, not `NextRequest`:

```typescript
// From Next.js documentation:
// "Route Handlers receive the standard Web Request and Response objects."
export async function GET(request: Request) { ... }  // ← Standard Request, not NextRequest
```

So mpay works perfectly out of the box.

---

## The Fix

Convert `NextRequest` to standard `Request` before passing to mpay functions.

### The Fix (UPDATED: Body Stream Bug)

The initial fix included `body: request.body`, but this introduced a **second bug**: by the time `verifyMPPCredential()` runs, the body has already been consumed by `parseBody()` in orchestrate.ts. Creating a Request with a consumed body stream throws an error.

**Final fix**: Remove body from `toStandardRequest()` entirely, since MPP only needs headers:

```typescript
// src/protocols/mpp.ts
/**
 * Converts NextRequest to standard Web API Request.
 *
 * NOTE: Body is intentionally omitted. By the time verifyMPPCredential() is
 * called, orchestrate.ts has already consumed the body stream via parseBody().
 * MPP verification only needs headers (Authorization), so this is safe.
 */
function toStandardRequest(request: Request): Request {
  if (request.constructor.name === 'Request') {
    return request;
  }

  // Headers only - body is consumed and not needed for MPP
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
  });
}
```

**Why this is safe**: `Credential.fromRequest()` only reads the `Authorization` header. See `tests/mpp-body-bug.test.ts` for the regression test.

---

## Testing Plan

### Phase 1: Test Locally with examples/fortune

**Setup:**
1. Build router with fix: `cd agentcash-router && pnpm build`
2. Start fortune example: `cd examples/fortune && pnpm dev`
3. Test with agentcash MCP using both x402 and MPP protocols

**Test MPP:**
```typescript
await mcp__agentcash__fetch({
  url: 'http://localhost:3000/api/fortune',
  method: 'GET',
  paymentMethod: 'mpp',
});
```

**Expected:**
- ✅ 402 challenge with `WWW-Authenticate` header
- ✅ Payment completes successfully
- ✅ 200 response with fortune + `Payment-Receipt` header

**Test x402 (ensure no regression):**
```typescript
await mcp__agentcash__fetch({
  url: 'http://localhost:3000/api/fortune',
  method: 'GET',
  paymentMethod: 'x402',
});
```

**Expected:**
- ✅ Still works perfectly

### Phase 2: Add Tests

**Add to `tests/mpp-payment.test.ts`:**
```typescript
it('converts NextRequest to standard Request for mpay compatibility', async () => {
  // Test that verifyMPPCredential handles NextRequest correctly
  // Mock NextRequest and verify it gets converted properly
});
```

### Phase 3: Publish and Deploy

1. Publish router@0.3.2 with fix
2. Update enrichx402 to 0.3.2
3. Deploy and validate on Vercel
4. Update CLAUDE.md with type mismatch warning

---

## Success Criteria

### Must Have ✅
- [ ] MPP credential verification succeeds with NextRequest
- [ ] Both x402 AND MPP work on examples/fortune locally
- [ ] MCP client completes full payment flow (402 → pay → 200)
- [ ] No regression in x402 payment flow
- [ ] At least 1 test validates NextRequest→Request conversion

### Nice to Have
- [ ] Add warning to CLAUDE.md about NextRequest vs Request
- [ ] Update other router implementations (stablestudio, etc)
- [ ] Performance comparison: conversion overhead negligible?

---

## Key Learnings

### What We Did Right
1. **Compared working vs broken implementations** - any-pay-server showed the difference
2. **Read mpay source code** - Understood exactly what `Credential.fromRequest()` expects
3. **Traced through type system** - Found the hidden type mismatch (NextRequest extends Request)

### What We Learned
1. **TypeScript subtyping can hide runtime incompatibilities** - `extends` doesn't guarantee full compatibility
2. **Next.js has two Request types**: standard `Request` (in route handlers) vs `NextRequest` (in middleware/orchestration)
3. **Test with real types** - Don't assume type compatibility means runtime compatibility
4. **Prior art is valuable** - Working implementation (any-pay-server) revealed the pattern

---

## Implementation Checklist

### Previous Work ✅
- [x] Fixed Challenge.fromIntent to use payment data instead of HTTP Request
- [x] Fixed currency format to use PathUSD token address
- [x] Added explicit decimals: 6 to challenge request
- [x] Validated MPP challenges generate with WWW-Authenticate header

### Current Work - NextRequest Fix
- [ ] Add toStandardRequest() helper to src/protocols/mpp.ts
- [ ] Update verifyMPPCredential() to convert request before mpay calls
- [ ] Update buildMPPChallenge() to convert request (for consistency)
- [ ] Test locally with examples/fortune and agentcash MCP
- [ ] Verify both x402 and MPP work end-to-end
- [ ] Add test for NextRequest→Request conversion
- [ ] Publish router@0.3.2
- [ ] Update CLAUDE.md with NextRequest warning
- [ ] Deploy to enrichx402 and validate
