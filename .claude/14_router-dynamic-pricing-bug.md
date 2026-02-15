# Router Dynamic Pricing Bug

**Date:** 2026-02-15
**Status:** Discovered during MCP testing
**Context:** PR #66 (unsupervised-goblin branch), @agentcash/router@0.2.2
**Severity:** Critical - All paid routes charging $10.00 instead of dynamic prices

---

## Discovery

While testing the x402 router migration with agentcash MCP tools, discovered that all job routes return 402 challenges with `amount: "10000000"` ($10.00 USDC) regardless of the actual job cost.

Example: Nano Banana generation should cost **$0.039** but the 402 challenge requests **$10.00** (256x overcharge).

### Test Results

✅ **Working:**
- Discovery endpoints (`/.well-known/x402`, `/api/openapi.json`) return correct schemas
- 402 response structure and headers correct
- Pre-payment validation (constraints, image URLs)
- SIWX routes structure

❌ **Broken:**
- All 23 job routes charge $10.00 regardless of model/settings
- Dynamic pricing function never called during 402 challenge
- Payment verification would fail (amount mismatch)

---

## Root Cause Analysis

### The Flow

**First Request (no payment header):**

```javascript
// createRequestHandler in @agentcash/router
async function createRequestHandler(routeEntry, handler, deps) {
  return async (request) => {
    const protocol = detectProtocol(request);  // null (no payment header)

    if (!protocol || protocol === "siwx") {
      return await build402(request, routeEntry, ...);  // ⚠️ Called BEFORE body parsing!
    }

    // Body parsing happens here (unreachable on first request)
    const body = await parseBody(request, routeEntry);
    let price = await resolvePrice(routeEntry.pricing, body.data);
    ...
  }
}
```

**build402 function:**

```javascript
async function build402(request, routeEntry, deps, meta, pluginCtx) {
  const response = new NextResponse(null, { status: 402 });

  let challengePrice;
  if (routeEntry.maxPrice) {
    challengePrice = routeEntry.maxPrice;  // ⚠️ Uses $10.00 directly!
  } else if (routeEntry.pricing) {
    // Can only handle static pricing (string) or tier max
    challengePrice = resolveMaxPrice(routeEntry.pricing);
  } else {
    challengePrice = "0";
  }

  // Returns 402 with challengePrice ($10.00)
  // pricing function is NEVER called
}
```

**Second Request (with payment header for $10.00):**

```javascript
async function createRequestHandler(routeEntry, handler, deps) {
  return async (request) => {
    const protocol = detectProtocol(request);  // "x402"

    // NOW body is parsed
    const body = await parseBody(request, routeEntry);

    // NOW pricing function is called
    let price = await resolvePrice(routeEntry.pricing, body.data);
    // Returns "0.039" for nano-banana

    if (protocol === "x402") {
      // Verify payment against actual price
      const verify = await verifyX402Payment(
        ...,
        price,  // ⚠️ Expects $0.039
        ...
      );

      // Payment is $10.00, verification expects $0.039
      if (!verify?.valid) {
        return await build402(...);  // ⚠️ Returns 402 again - infinite loop!
      }
    }
  }
}
```

### The Problem

1. **402 challenge built before body parsing** → can't call pricing function (needs body)
2. **Uses `maxPrice` as challenge price** → client signs payment for $10.00
3. **Payment verification uses dynamic price** → expects $0.039
4. **Amounts don't match** → verification fails
5. **Returns 402 again** → infinite loop

### Why Our Code Triggers This

**In `src/lib/x402-routes.ts:153`:**

```typescript
jobHandlers[`${modelId}/${operation}`] = base
  .paid(pricingFn, { maxPrice: "10.00" })  // ⚠️ Triggers the bug
  .body(bodySchema)
  .handler(handlerFn);
```

The router's type signature **requires** `maxPrice` when using a pricing function:

```typescript
paid<TBodyIn>(
  pricing: (body: TBodyIn) => string | Promise<string>,
  options?: PaidOptions & { maxPrice: string }  // maxPrice required!
): RouteBuilder<...>
```

But the implementation uses `maxPrice` as the **actual price** in 402 challenges, not as a ceiling.

---

## Impact

### On Production
- **All paid job requests would fail** with continuous 402 responses
- Users would see "Payment Required" errors even after signing payment
- MCP tools would report payment verification failures
- No jobs could be created via x402 payment

### On PR #66
- PR cannot be merged in current state
- Would break all paid functionality
- Discovery endpoints work but actual payments fail

---

## Analysis: Is This a Router Bug or Design Issue?

### Router's Intended Design (Hypothesis A)

The router might be designed for **overpayment acceptance**, where:
- Challenge uses `maxPrice` as ceiling
- Client pays `maxPrice`
- Server settles for actual price (less than or equal to `maxPrice`)
- Excess funds returned/credited

**Evidence against:** The verification code builds requirements with exact price, not a range. Also, paying $10 for a $0.04 job seems unreasonable.

### Router's Actual Limitation (Hypothesis B - MOST LIKELY)

The router's architecture has a fundamental limitation:
- 402 challenges must be built **before** request body parsing
- Dynamic pricing functions **require** request body
- Therefore, **true dynamic pricing is impossible** at 402 challenge time
- `maxPrice` is used as the challenge price because nothing else is available

**Evidence for:**
- Code flow clearly shows `build402` called before `parseBody`
- `resolveMaxPrice` can only handle static prices or tier maxes, not functions
- Type signature requires `maxPrice` for function-based pricing (admission of limitation)

---

## Our Options

### Option 1: Accept Fixed Pricing Per Route

**Change:** Remove dynamic pricing, use fixed price per model/operation combo.

**Implementation:**
```typescript
// Calculate highest possible price for each job type at registration
const maxJobPrice = calculateJobCostFromRegistry(
  jobType,
  // Use most expensive possible settings
  { ...defaultSettings, imageSize: "4K", duration: "15", quality: "high" }
);

jobHandlers[`${modelId}/${operation}`] = base
  .paid(maxJobPrice.toFixed(2))  // Fixed price, no function
  .body(bodySchema)
  .handler(handlerFn);
```

**Pros:**
- Simple, works with current router
- No risk of amount mismatch
- Clear pricing in discovery docs

**Cons:**
- Overcharges users with cheaper settings (e.g., 1K charged same as 4K)
- Loses dynamic pricing benefit
- Less competitive pricing

### Option 2: Parse Body Before 402 (Router Fix)

**Change:** Modify router to parse body before building 402 challenge when pricing function exists.

**Implementation (in router):**
```javascript
async function createRequestHandler(routeEntry, handler, deps) {
  return async (request) => {
    const protocol = detectProtocol(request);

    // NEW: Parse body early if dynamic pricing function exists
    let parsedBody = undefined;
    if (typeof routeEntry.pricing === "function" && !protocol) {
      parsedBody = await parseBody(request, routeEntry);
      if (!parsedBody.ok) return parsedBody.response;
    }

    if (!protocol || protocol === "siwx") {
      // Pass parsed body to build402
      return await build402(request, routeEntry, ..., parsedBody?.data);
    }
    ...
  }
}

async function build402(request, routeEntry, ..., bodyData) {
  let challengePrice;
  if (routeEntry.maxPrice && typeof routeEntry.pricing === "function" && bodyData) {
    // Call pricing function with body data
    challengePrice = await resolvePrice(routeEntry.pricing, bodyData);
  } else if (routeEntry.maxPrice) {
    challengePrice = routeEntry.maxPrice;
  }
  ...
}
```

**Pros:**
- True dynamic pricing works as intended
- Users pay correct amounts
- Competitive pricing preserved

**Cons:**
- Requires router changes (we don't control @agentcash/router)
- Slightly more complex flow
- Need to buffer/replay body for second parsing

### Option 3: Tiered Pricing by Request Parameters

**Change:** Use router's built-in tiered pricing based on settings fields.

**Implementation:**
```typescript
// Define tiers based on common settings
const imageSizeTiers = {
  "1K": { price: "0.13" },
  "2K": { price: "0.18" },
  "4K": { price: "0.24" },
};

jobHandlers[`${modelId}/${operation}`] = base
  .paid({ field: "imageSize", tiers: imageSizeTiers, default: "1K" })
  .body(bodySchema)
  .handler(handlerFn);
```

**Pros:**
- Works with current router (no fixes needed)
- More granular than Option 1
- Clear pricing tiers in discovery

**Cons:**
- Can only price on one field (imageSize OR duration, not both)
- Doesn't capture full pricing complexity (multiple factors)
- Still not as accurate as function-based pricing

### Option 4: Pre-flight Price Check Endpoint

**Change:** Add a separate endpoint for price calculation before payment.

**Flow:**
1. Client POSTs to `/api/x402/price-check` with job settings
2. Server returns exact price
3. Client initiates job creation with price expectation
4. Server validates price matches and processes

**Pros:**
- Works with current router
- True dynamic pricing
- Client knows exact price before payment

**Cons:**
- Requires client changes (MCP tools, SDK)
- Extra round trip (slower)
- More complex integration

### Option 5: Use MPP (Metered Payment Protocol)

**Change:** Switch from x402 to MPP for job routes (keep x402 for uploads).

**Note:** Requires research into MPP capabilities and limitations. Not evaluated here.

---

## Recommendation

**Short-term (to unblock PR #66):** Option 1 (Fixed Pricing Per Route)
- Gets PR merged and deployed
- Pricing is high but functional
- Can iterate later

**Medium-term (next 1-2 weeks):** Option 2 (Router Fix)
- Open issue/PR on agentcash-router repo
- Implement body-aware 402 challenge generation
- Test thoroughly and publish

**Long-term consideration:** Option 3 or 4 depending on pricing complexity needs

---

## Next Steps

1. ⏸️ **Pause PR #66 merge** until pricing fixed
2. 🐛 **Choose fix approach** (discuss with team)
3. 🔧 **Implement chosen fix**
4. ✅ **Test with MCP tools** (verify payment flow works)
5. 📝 **Update documentation** (pricing strategy)
6. 🚢 **Merge PR #66**

---

## Questions for Discussion

1. **Tolerance for overcharging:** Is fixed max pricing acceptable temporarily?
2. **Router ownership:** Can we contribute fixes to @agentcash/router?
3. **Pricing complexity:** How important is multi-factor dynamic pricing vs. simple tiers?
4. **Timeline:** Block merge until fixed, or deploy with known limitation?
