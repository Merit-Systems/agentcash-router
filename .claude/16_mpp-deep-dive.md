# MPP (Machine Payments Protocol) Deep Dive

**Date:** 2026-02-15
**Status:** Research Complete
**Source:** https://mpp.tempo.xyz/overview, router code analysis
**Context:** Understanding MPP to ensure dynamic pricing solution works for both x402 and MPP

---

## What is MPP?

**Machine Payments Protocol** (MPP) is an internet-native payments protocol that standardizes HTTP 402 for machine-to-machine transactions. It enables programmatic payment flows without browser automation, captchas, or checkout forms.

**Key characteristics:**
- Built on IETF-track specification (open standard)
- Uses HTTP 402 status code and standard headers
- Multi-rail (crypto, cards, bank transfers)
- Multi-currency (USD, EUR, USDC, BTC, etc.)
- Composable with extensions for disputes, identity, etc.

**Use cases:**
- Paid APIs (no API keys, no billing accounts)
- MCP servers (AI agents pay autonomously)
- Digital content (pay-per-access)

---

## MPP vs x402

### Similarities

Both protocols use HTTP 402 and share the same conceptual flow:

| Aspect | x402 | MPP |
|--------|------|-----|
| Status code | 402 Payment Required | 402 Payment Required |
| Challenge header | `PAYMENT-REQUIRED` (custom) | `WWW-Authenticate: Payment` (standard) |
| Credential header | `PAYMENT-SIGNATURE` (custom) | `Authorization: Payment` (standard) |
| Receipt header | `PAYMENT-RESPONSE` (custom) | `Payment-Receipt` (standard) |
| Flow | Challenge → Pay → Verify → Settle | Challenge → Pay → Verify → Settle |
| Pricing | Amount in challenge | Amount in challenge |

### Differences

| Aspect | x402 | MPP |
|--------|------|-----|
| **Standardization** | Proprietary (Coinbase) | IETF-track spec |
| **Header format** | Base64 JSON | HTTP auth scheme |
| **Payment networks** | EVM chains (Base, Ethereum) | Multi-network (Tempo, Stripe, custom) |
| **Primary use case** | Crypto payments (USDC on Base) | General machine payments |
| **Maturity** | Production (Coinbase x402) | Emerging (Tempo MPP) |

### Why Support Both?

- **x402**: Established, battle-tested, optimized for crypto
- **MPP**: Standards-based, broader network support, future-proof
- **Different networks**: x402 for Base/Ethereum, MPP for Tempo/Stripe
- **User choice**: Let clients pick their preferred payment method

---

## MPP Payment Flow

### 1. Client Requests Resource

```http
GET /api/generate HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"prompt": "a cat", "imageSize": "4K"}
```

### 2. Server Returns Challenge (402)

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment id="qB3wErTyU7iOpAsD9fGhJk",
    realm="api.example.com",
    method="tempo",
    intent="charge",
    expires="2025-01-15T12:05:00Z",
    request="eyJhbW91bnQiOiIyNDAwMDAiLCJjdXJyZW5jeSI6IjB4MjBjMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInJlY2lwaWVudCI6IjB4YTcyNmExQ0Q3MjM0MDkwNzRERjkxMDhBMjE4N2NmQTE5ODk5YUNGOCY)
```

**Decoded `request` parameter:**
```json
{
  "amount": "240000",        // $0.24 in micro-units (6 decimals)
  "currency": "0x20c0000000000000000000000000000000000000",  // USDC on Tempo
  "recipient": "0xa726a1CD723409074DF9108A2187cfA19899aCF8"
}
```

### 3. Client Fulfills Payment

Client signs a transaction, pays an invoice, or completes card payment based on the `method` field.

**For Tempo (blockchain):**
- Signs a TIP-20 `transfer` transaction
- No broadcast yet (credential contains signed tx)

**For Stripe (cards):**
- Completes payment with Stripe API
- Gets payment token as proof

### 4. Client Retries with Credential

```http
GET /api/generate HTTP/1.1
Host: api.example.com
Authorization: Payment <base64-credential>
Content-Type: application/json

{"prompt": "a cat", "imageSize": "4K"}
```

**Credential contains:**
- Challenge ID (binds to original challenge)
- Payment proof (signed tx, token, etc.)
- Method-specific data

### 5. Server Verifies and Settles

```typescript
// Parse credential from Authorization header
const credential = Credential.fromRequest(request);

// Verify challenge binding (HMAC check)
const isValid = Challenge.verify(credential.challenge, { secretKey });

// Verify payment proof and settle
const verifyResult = await tempo.charge({
  amount: "240000",
  currency: "0x20c0...",
  recipient: "0xa726..."
}).verify(credential);

if (verifyResult.valid) {
  // Payment settled, deliver resource
}
```

### 6. Server Returns Resource + Receipt

```http
HTTP/1.1 200 OK
Payment-Receipt: <base64-receipt>
Content-Type: application/json

{"jobId": "job_123", "status": "pending"}
```

**Receipt contains:**
- Payment method
- Transaction reference (txHash, payment ID, etc.)
- Timestamp
- Status

---

## Challenge Structure (Deep Dive)

### Required Parameters

```http
WWW-Authenticate: Payment id="qB3wErTyU7iOpAsD9fGhJk",
    realm="api.example.com",
    method="tempo",
    intent="charge",
    request="eyJ..."
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `id` | Unique challenge ID (HMAC-bound) | `qB3wErTyU7iOpAsD9fGhJk` |
| `realm` | Protection space (API domain) | `api.example.com` |
| `method` | Payment method identifier | `tempo`, `stripe` |
| `intent` | Payment type | `charge`, `session` |
| `request` | Base64url-encoded payment details | See below |

### Request Object

The `request` parameter contains method-specific payment details:

**Common fields (all methods):**
```json
{
  "amount": "240000",           // Required: base units (cents, wei, etc.)
  "currency": "usd",            // Required: currency code or token address
  "recipient": "0xa726...",     // Optional: payment destination
  "description": "Image gen",   // Optional: human-readable description
  "expires": "2025-01-15...",   // Optional: expiry timestamp
  "externalId": "req_123"       // Optional: idempotency key
}
```

**Tempo-specific fields:**
```json
{
  "chainId": "42431",           // Tempo mainnet
  "feePayer": true,             // Server sponsors gas fees
  "methodDetails": {
    "feePayer": "0x..."         // Fee sponsor address
  }
}
```

**Stripe-specific fields:**
```json
{
  "paymentMethodTypes": ["card", "us_bank_account"],
  "setupFutureUsage": "off_session"
}
```

### Challenge Binding (Security)

The `id` field is **cryptographically bound** to challenge parameters using HMAC:

```typescript
const id = hmac({
  realm,
  method,
  intent,
  requestHash: sha256(JSON.stringify(request)),
  expires
}, secretKey);
```

**Why binding matters:**
- Prevents clients from reusing a challenge ID with modified payment terms
- Client can't change `amount: "1.00"` to `amount: "0.01"` and replay the challenge
- Server verifies binding during credential verification

---

## Intents

MPP supports different payment patterns through **intents**:

### 1. Charge Intent (One-time Payment)

**Use case:** Single API call, content access, fixed-price transaction

**Flow:**
1. Client requests resource
2. Server returns challenge with fixed amount
3. Client pays exact amount
4. Server verifies and settles immediately
5. Returns resource + receipt

**Example:**
```typescript
await mppx.charge({
  amount: '0.24',
  currency: '0x20c0...',
  recipient: '0xa726...'
})(request)
```

**Best for:**
- Paid APIs with known cost per request
- Pay-per-article or pay-per-query
- MCP tool calls with fixed pricing
- Simple integrations (no state management)

### 2. Session Intent (Metered Payment)

**Use case:** Usage-based billing, streaming, WebSocket connections

**Flow:**
1. Client opens session with deposit
2. Server tracks usage (requests, tokens, time)
3. Server periodically settles increments
4. Client can add funds or close session
5. Final settlement on close

**Example:**
```typescript
await mppx.session({
  deposit: '10.00',
  currency: '0x20c0...',
  recipient: '0xa726...'
})(request)
```

**Best for:**
- Metered APIs (pay per token, per second, per MB)
- Streaming services
- Long-lived connections
- Unknown upfront cost

**Not relevant for stablestudio:** Our jobs have known costs upfront, so **charge intent is sufficient**.

---

## Payment Methods

### Tempo (Blockchain)

**Network:** Tempo blockchain (EVM-compatible L2)
**Asset:** TIP-20 tokens (USDC, etc.)
**Finality:** ~500ms deterministic finality
**Gas:** Optional fee sponsorship (server pays gas)

**Client flow:**
1. Signs `transfer` transaction (doesn't broadcast)
2. Includes signed tx in credential
3. Server verifies signature and broadcasts
4. Settlement in ~500ms

**Key feature:** Fee sponsorship lets clients pay without gas tokens.

**Example challenge:**
```json
{
  "amount": "240000",
  "currency": "0x20c0000000000000000000000000000000000000",
  "recipient": "0xa726a1CD723409074DF9108A2187cfA19899aCF8",
  "chainId": "42431",
  "feePayer": true
}
```

### Stripe (Cards)

**Network:** Stripe payment processing
**Asset:** Fiat (USD, EUR, etc.)
**Finality:** Immediate authorization, ~2 days settlement
**Fees:** Stripe's standard fees (2.9% + $0.30)

**Client flow:**
1. Creates Stripe Payment Token
2. Includes token in credential
3. Server charges card via Stripe API
4. Returns success/failure

**Key feature:** Cards and bank accounts (broader consumer reach).

**Example challenge:**
```json
{
  "amount": "24",  // $0.24 in cents
  "currency": "usd",
  "recipient": "acct_1234567890",
  "paymentMethodTypes": ["card", "us_bank_account"]
}
```

### Custom Methods

MPP allows custom payment methods:

```typescript
mppx.create({
  methods: [
    {
      id: 'lightning',
      charge: async (request) => {
        // Generate Lightning invoice
        // Verify payment
        // Return result
      }
    }
  ]
})
```

**Potential custom methods:**
- Bitcoin Lightning
- Bank transfers (ACH, SEPA)
- Stablecoins on other chains (Polygon, Arbitrum)
- Corporate invoices
- Internal credits/balances

---

## Router Implementation Analysis

### Current Code (in @agentcash/router)

```javascript
// buildMPPChallenge - called during 402 response
async function buildMPPChallenge(routeEntry, request, mppConfig, price) {
  await ensureMpay();

  // Create charge intent with price
  const methodIntent = tempo.charge({
    amount: price,  // ⚠️ Price parameter needed here!
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? ''
  });

  // Create challenge from intent
  const challenge = Challenge.fromIntent(methodIntent, {
    secretKey: mppConfig.secretKey,
    realm: new URL(request.url).origin,
    request
  });

  return Challenge.serialize(challenge);
}

// verifyMPPCredential - called when payment arrives
async function verifyMPPCredential(request, _routeEntry, mppConfig, price) {
  await ensureMpay();

  // Parse credential from Authorization header
  const credential = Credential.fromRequest(request);
  if (!credential) return null;

  // Verify challenge binding
  const isValid = Challenge.verify(credential.challenge, {
    secretKey: mppConfig.secretKey
  });
  if (!isValid) return { valid: false, payer: null };

  // Verify payment with same price
  const chargeConfig = {
    amount: price,  // ⚠️ Same price used for verification!
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? ''
  };

  const verifyResult = await tempo.charge(chargeConfig).verify(credential);
  if (!verifyResult?.valid) {
    return { valid: false, payer: null };
  }

  return { valid: true, payer: verifyResult.payer };
}
```

### How It's Called in Handler

```javascript
async function createRequestHandler(routeEntry, handler, deps) {
  return async (request) => {
    const protocol = detectProtocol(request);

    // First request (no payment)
    if (!protocol) {
      return await build402(request, routeEntry, deps, meta, pluginCtx);
    }

    // Request with payment
    const body = await parseBody(request, routeEntry);
    let price = await resolvePrice(routeEntry.pricing, body.data);

    if (protocol === 'mpp') {
      const verify = await verifyMPPCredential(request, routeEntry, deps.mppConfig, price);
      if (!verify?.valid) {
        return await build402(request, routeEntry, deps, meta, pluginCtx);
      }

      // Execute handler
      const { response } = await invoke(...);

      // Add receipt
      response.headers.set('Payment-Receipt', await buildMPPReceipt(...));
      return response;
    }
  }
}

async function build402(request, routeEntry, deps, meta, pluginCtx) {
  let challengePrice;

  if (routeEntry.maxPrice) {
    challengePrice = routeEntry.maxPrice;  // ⚠️ Uses maxPrice, not dynamic price!
  }

  // Build MPP challenge with challengePrice
  if (routeEntry.protocols.includes('mpp') && deps.mppConfig) {
    const serialized = await buildMPPChallenge(
      routeEntry,
      request,
      deps.mppConfig,
      challengePrice  // ⚠️ Wrong price passed!
    );
    response.headers.set('WWW-Authenticate', `Payment ${serialized}`);
  }

  return response;
}
```

### The Problem

**Identical to x402 issue:**

1. **build402 called before body parsing** → can't call pricing function
2. **Uses maxPrice as challenge price** → client signs payment for $10.00
3. **Payment verification uses dynamic price** → expects $0.24
4. **Amounts don't match** → verification fails
5. **Returns 402 again** → infinite loop

**Both protocols broken by same bug!**

---

## Our Solution Works for Both

The early body parsing solution fixes **both x402 and MPP**:

### 1. Parse Body Early

```javascript
async function createRequestHandler(routeEntry, handler, deps) {
  return async (request) => {
    const protocol = detectProtocol(request);

    // 🆕 Early body parsing for dynamic pricing
    let earlyBodyResult;
    if (!protocol && typeof routeEntry.pricing === 'function' && routeEntry.bodySchema) {
      earlyBodyResult = await parseBody(request, routeEntry);
      if (!earlyBodyResult.ok) return earlyBodyResult.response;
    }

    if (!protocol) {
      return await build402(
        request,
        routeEntry,
        deps,
        meta,
        pluginCtx,
        earlyBodyResult?.data  // 🆕 Pass parsed body
      );
    }

    // Normal flow...
  }
}
```

### 2. Call Pricing Function in build402

```javascript
async function build402(request, routeEntry, deps, meta, pluginCtx, bodyData?) {
  let challengePrice;

  // 🆕 Dynamic pricing with body data
  if (bodyData && typeof routeEntry.pricing === 'function') {
    try {
      challengePrice = await resolvePrice(routeEntry.pricing, bodyData);
      // Validate against maxPrice ceiling
      if (routeEntry.maxPrice && parseFloat(challengePrice) > parseFloat(routeEntry.maxPrice)) {
        challengePrice = routeEntry.maxPrice;
      }
    } catch (err) {
      challengePrice = routeEntry.maxPrice ?? '0';
    }
  } else if (routeEntry.maxPrice) {
    challengePrice = routeEntry.maxPrice;
  }

  // Build challenges with calculated price (works for both!)
  if (routeEntry.protocols.includes('x402') && deps.x402Server) {
    await buildX402Challenge(..., challengePrice, ...);
  }

  if (routeEntry.protocols.includes('mpp') && deps.mppConfig) {
    const serialized = await buildMPPChallenge(..., deps.mppConfig, challengePrice);
    response.headers.set('WWW-Authenticate', `Payment ${serialized}`);
  }

  return response;
}
```

### 3. Verification Matches Challenge

```javascript
// Request with payment
const body = earlyBodyResult ?? await parseBody(request, routeEntry);
let price = await resolvePrice(routeEntry.pricing, body.data);
// Now price === challengePrice (both $0.24)

if (protocol === 'x402') {
  const verify = await verifyX402Payment(..., price, ...);  // ✅ Matches!
  ...
}

if (protocol === 'mpp') {
  const verify = await verifyMPPCredential(..., price);  // ✅ Matches!
  ...
}
```

---

## MPP-Specific Considerations

### 1. Multiple Challenges

MPP allows offering both x402 and MPP in the same 402 response:

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Miw...  (x402)
WWW-Authenticate: Payment id="abc", method="tempo", ...  (MPP)
```

**Router support:**
```javascript
async function build402(request, routeEntry, deps, meta, pluginCtx, bodyData?) {
  const response = new NextResponse(null, { status: 402 });
  let challengePrice = await calculatePrice(bodyData, routeEntry.pricing);

  // Add both challenges with same price
  if (routeEntry.protocols.includes('x402')) {
    const x402Challenge = await buildX402Challenge(..., challengePrice, ...);
    response.headers.set('PAYMENT-REQUIRED', x402Challenge);
  }

  if (routeEntry.protocols.includes('mpp')) {
    const mppChallenge = await buildMPPChallenge(..., challengePrice);
    response.headers.set('WWW-Authenticate', `Payment ${mppChallenge}`);
  }

  return response;
}
```

**Client choice:** Client selects preferred method based on capabilities.

### 2. Protocol Detection

```javascript
function detectProtocol(request: NextRequest): Protocol | null {
  // MPP uses Authorization: Payment
  if (request.headers.get('Authorization')?.startsWith('Payment ')) {
    return 'mpp';
  }

  // x402 uses PAYMENT-SIGNATURE
  if (request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT')) {
    return 'x402';
  }

  return null;
}
```

**No conflict:** Headers are distinct, protocol detection is unambiguous.

### 3. Receipt Format

**x402 receipt:**
```http
PAYMENT-RESPONSE: <base64-x402-response>
```

**MPP receipt:**
```http
Payment-Receipt: <base64-mpp-receipt>
```

**Both can coexist** in the same response if needed.

### 4. Settlement Timing

**Both protocols support both patterns:**

**Verify → Execute → Settle (default):**
```javascript
const verify = await verifyMPPCredential(...);
const result = await handler(...);
if (result.ok) {
  await settleMPPPayment(...);  // Settle after success
}
```

**Settle → Execute (high-risk):**
```javascript
const verify = await verifyMPPCredential(...);
await settleMPPPayment(...);  // Settle first
const result = await handler(...);
```

**For Tempo charge:** Settlement happens during `verify()`, so both patterns collapse to the same thing (broadcast during verification).

**For x402:** Settlement is explicit (separate `settlePayment()` call).

---

## Comparison Table: x402 vs MPP

| Feature | x402 | MPP |
|---------|------|-----|
| **Protocol** | Proprietary | IETF-track standard |
| **Challenge header** | `PAYMENT-REQUIRED` | `WWW-Authenticate: Payment` |
| **Credential header** | `PAYMENT-SIGNATURE` | `Authorization: Payment` |
| **Receipt header** | `PAYMENT-RESPONSE` | `Payment-Receipt` |
| **Networks** | EVM (Base, Ethereum, etc.) | Multi-network (Tempo, Stripe, custom) |
| **Format** | Base64 JSON | HTTP auth scheme (structured) |
| **Extensions** | SIWX, Bazaar | Extensible via intents/methods |
| **Primary currency** | USDC on Base | Flexible (USDC, USD, etc.) |
| **Finality** | Depends on chain (~2s Base) | Depends on method (~500ms Tempo) |
| **Fee sponsorship** | Via facilitator | Native (Tempo feePayer) |
| **Maturity** | Production-ready | Emerging |
| **Our usage** | Default for crypto payments | Future-proofing, Tempo support |

---

## Dynamic Pricing Solution: Unified for Both

### Requirement

Both x402 and MPP need the **exact same price** in:
1. Initial 402 challenge
2. Payment verification

### Solution

**Single implementation** works for both:

```typescript
async function build402(request, routeEntry, deps, meta, pluginCtx, bodyData?) {
  // Calculate price (works for dynamic, static, or tiered)
  let challengePrice = await calculateChallengePrice(routeEntry, bodyData);

  const response = new NextResponse(null, { status: 402 });

  // x402 challenge
  if (routeEntry.protocols.includes('x402') && deps.x402Server) {
    const challenge = await buildX402Challenge(
      deps.x402Server,
      routeEntry,
      request,
      challengePrice,  // ✅ Same price
      deps.payeeAddress,
      deps.network,
      extensions
    );
    response.headers.set('PAYMENT-REQUIRED', challenge);
  }

  // MPP challenge
  if (routeEntry.protocols.includes('mpp') && deps.mppConfig) {
    const challenge = await buildMPPChallenge(
      routeEntry,
      request,
      deps.mppConfig,
      challengePrice  // ✅ Same price
    );
    response.headers.set('WWW-Authenticate', `Payment ${challenge}`);
  }

  return response;
}

async function calculateChallengePrice(routeEntry, bodyData?) {
  // Dynamic pricing with body
  if (bodyData && typeof routeEntry.pricing === 'function') {
    try {
      const calculated = await resolvePrice(routeEntry.pricing, bodyData);
      // Validate against maxPrice ceiling
      if (routeEntry.maxPrice && parseFloat(calculated) > parseFloat(routeEntry.maxPrice)) {
        return routeEntry.maxPrice;
      }
      return calculated;
    } catch (err) {
      // Fallback to maxPrice if pricing fails
      if (routeEntry.maxPrice) return routeEntry.maxPrice;
      throw err;
    }
  }

  // Static or tiered pricing
  if (routeEntry.maxPrice) return routeEntry.maxPrice;
  if (routeEntry.pricing) return resolveMaxPrice(routeEntry.pricing);

  return '0';
}
```

**Key insight:** Both protocols use the same `price` parameter in challenge generation and verification. Our solution fixes both simultaneously.

---

## Testing Strategy for MPP

### Unit Tests

```typescript
describe('MPP dynamic pricing', () => {
  it('calls pricing function before MPP challenge', async () => {
    const pricingFn = vi.fn((body) => body.size === 'large' ? '10.00' : '5.00');

    const route = router.route('test')
      .body(z.object({ size: z.enum(['small', 'large']) }))
      .paid(pricingFn)
      .handler(async () => ({ success: true }));

    const req = new Request('http://test/api/test', {
      method: 'POST',
      body: JSON.stringify({ size: 'large' }),
    });

    const res = await route(req);
    expect(res.status).toBe(402);
    expect(pricingFn).toHaveBeenCalledWith({ size: 'large' });

    const wwwAuth = res.headers.get('WWW-Authenticate');
    expect(wwwAuth).toContain('Payment');

    // Parse MPP challenge
    const challenge = parseWWWAuthenticate(wwwAuth);
    const request = JSON.parse(base64Decode(challenge.request));
    expect(request.amount).toBe('10000000');  // $10.00 in micro-units
  });

  it('supports both x402 and MPP with same price', async () => {
    const route = router.route('test')
      .body(z.object({ input: z.string() }))
      .paid((body) => '2.50')
      .handler(async () => ({ success: true }));

    const req = new Request('http://test/api/test', {
      method: 'POST',
      body: JSON.stringify({ input: 'test' }),
    });

    const res = await route(req);

    // Both challenges present
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
    expect(res.headers.get('WWW-Authenticate')).toBeTruthy();

    // Same price in both
    const x402 = parseX402Challenge(res.headers.get('PAYMENT-REQUIRED'));
    const mpp = parseMPPChallenge(res.headers.get('WWW-Authenticate'));

    expect(x402.accepts[0].amount).toBe('2500000');  // $2.50
    expect(JSON.parse(base64Decode(mpp.request)).amount).toBe('2500000');
  });
});
```

### Integration Tests

```typescript
describe('MPP payment flow', () => {
  it('completes payment with Tempo', async () => {
    // 1. Request without payment
    const res1 = await POST('/api/jobs', {
      body: { model: 'nano-banana', imageSize: '4K' }
    });
    expect(res1.status).toBe(402);

    const wwwAuth = res1.headers.get('WWW-Authenticate');
    const challenge = parseMPPChallenge(wwwAuth);

    // 2. Sign Tempo transaction
    const credential = await signTempoCharge(challenge, account);

    // 3. Retry with credential
    const res2 = await POST('/api/jobs', {
      body: { model: 'nano-banana', imageSize: '4K' },
      headers: { 'Authorization': `Payment ${credential}` }
    });

    expect(res2.status).toBe(200);
    expect(res2.headers.get('Payment-Receipt')).toBeTruthy();
    expect(res2.json()).toMatchObject({ jobId: expect.any(String) });
  });
});
```

---

## Recommendations

### 1. Support Both Protocols ✅

**Why:**
- x402: Production-ready, optimized for Base/Ethereum
- MPP: Standards-based, future-proof, supports Tempo/Stripe

**How:**
- Router already has infrastructure for both
- Our dynamic pricing fix works for both
- Minimal additional complexity

**Config:**
```typescript
router.route('job')
  .paid(pricingFn)
  .protocols(['x402', 'mpp'])  // Support both
  .handler(...)
```

### 2. Default to x402, Enable MPP on Demand

**Rationale:**
- x402 is battle-tested and widely used
- MPP is newer, less client tooling
- Offering both gives clients choice

**Config:**
```typescript
// Default: x402 only
router.route('job').paid(pricingFn).handler(...)

// Explicit: both
router.route('job')
  .paid(pricingFn)
  .protocols(['x402', 'mpp'])
  .handler(...)
```

### 3. Use Charge Intent (Not Session)

**Rationale:**
- Our jobs have known costs upfront
- No metering needed
- Simpler flow, fewer states

**Implementation:**
```typescript
// tempo.charge (what we use)
const methodIntent = tempo.charge({
  amount: price,
  currency: mppConfig.currency,
  recipient: mppConfig.recipient
});

// tempo.session (not needed for us)
const methodIntent = tempo.session({
  deposit: '10.00',
  currency: mppConfig.currency,
  recipient: mppConfig.recipient
});
```

### 4. Consider Fee Sponsorship for MPP/Tempo

**Benefit:** Clients don't need gas tokens

**Trade-off:** We pay gas fees

**Config:**
```typescript
mppConfig: {
  currency: '0x20c0...',
  recipient: '0xa726...',
  feePayer: true  // 🆕 Sponsor gas
}
```

**Cost:** ~$0.0001 per transaction on Tempo

---

## Summary

### Key Findings

1. **MPP = Machine Payments Protocol** - Standards-based HTTP 402 for machine payments
2. **Same architecture as x402** - Challenge → Credential → Receipt flow
3. **Same pricing issue** - Challenge built before body parsing
4. **Same solution works** - Early body parsing fixes both protocols
5. **Both protocols needed** - x402 for Base/Ethereum, MPP for Tempo/Stripe/future

### Implementation Impact

**Our dynamic pricing solution fixes both x402 AND MPP with:**
- Single code path (unified `calculateChallengePrice`)
- Early body parsing (when dynamic pricing exists)
- Same price used in both challenge types
- No protocol-specific workarounds needed

### Next Steps

1. ✅ **Research complete** - MPP deeply understood
2. 🔧 **Implement solution** - Router changes for early body parsing
3. ✅ **Test both protocols** - x402 and MPP test suites
4. 📦 **Publish router@0.2.3** - With fix for both
5. ⬆️ **Update stablestudio** - Bump dependency
6. 🧪 **Test with MCP** - Verify both x402 and MPP work
7. 🚢 **Merge PR #66** - Ship it!
