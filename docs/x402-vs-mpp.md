# x402 and MPP: protocol comparison & router terminology guide

> Written 2026-07-07 from the current docs at [docs.x402.org](https://docs.x402.org) (x402 V2, x402 Foundation),
> the spec repo `x402-foundation/x402`, [mpp.dev](https://mpp.dev), and the IETF-style drafts at
> [paymentauth.org](https://paymentauth.org) (`draft-httpauth-payment-00`, `draft-tempo-session-00`).
> Audience: humans and agents working on `@agentcash/router`, which speaks **both** protocols.

## TL;DR

- **x402** ("an open, neutral standard for internet-native payments", now governed by the x402
  Foundation, V2 current) is a *blockchain payment* protocol: custom headers, a **scheme × network**
  matrix (`exact`, `upto`, `batch-settlement`), and an optional **facilitator** that verifies and
  settles on-chain for you.
- **MPP** (**Machine Payments Protocol** — not "micropayment"; co-authored by Tempo and Stripe,
  IETF standards track) is a *payment authentication scheme* for HTTP: it extends the standard
  `WWW-Authenticate` / `Authorization` machinery with a `Payment` scheme and a
  **method × intent** matrix (`tempo`/`stripe`/`evm`/`lightning`/… × `charge`/`session`/`subscription`).
- They rhyme deliberately (MPP: "MPP builds on the same 402 pattern that x402 established") and
  interop exists (MPP's `evm` method can run x402 `exact` flows inline). The big functional gap:
  **x402 explicitly scopes out multi-settlement streaming; MPP's `session` intent is exactly that.**
- Our router bridges both: `.paid()` → x402 `exact` **and** MPP `charge`; `.upTo()` → x402 `upto`;
  `.metered()`/`.stream()` → MPP `session` over SSE. The terminology mismatches (and a concrete
  renaming proposal) are at the [bottom](#router-terminology-the-confusion-and-a-proposal).

---

## 1. The handshake, side by side

Both protocols are HTTP-402 challenge/retry flows carrying base64-encoded JSON. They differ in
*where* the payload rides:

| Step | x402 V2 | MPP |
|---|---|---|
| Server demands payment | `402` + **`PAYMENT-REQUIRED`** header (base64 `PaymentRequired`: `x402Version`, `resource`, `accepts[]`) | `402` + **`WWW-Authenticate: Payment id=…, realm=…, method=…, intent=…, request=…`** (Challenge) |
| Client pays / signs | picks an `accepts[]` entry, signs a scheme-specific payload | fulfills the Challenge (signs tx, pays invoice, signs voucher, …) |
| Client retries | **`PAYMENT-SIGNATURE`** header (base64 `PaymentPayload`) | **`Authorization: Payment <base64url credential>`** (Credential) |
| Server confirms | `200` + **`PAYMENT-RESPONSE`** header (base64 `SettlementResponse`) | `200` + **`Payment-Receipt`** header (Receipt) |

MPP's own docs publish this exact correspondence: `PAYMENT-REQUIRED` ↔ `WWW-Authenticate: Payment`,
`PAYMENT-SIGNATURE` ↔ `Authorization: Payment`, `PAYMENT-RESPONSE` ↔ `Payment-Receipt`.

Design-philosophy difference behind the same shape: x402 invents three custom headers and versions
them on the wire (`x402Version: 2`); MPP reuses the standard HTTP auth scheme mechanism
(RFC 9110 §11) and carries **no version on the wire** ("consistent with Basic, Bearer, Digest" —
an incompatible change would be a new scheme name).

## 2. Terminology map

| Concept | x402 term | MPP term | Notes |
|---|---|---|---|
| "here's what you must pay" | `PaymentRequired` / **payment requirements** (`accepts[]` entries) | **Challenge** | MPP Challenges are HMAC-bound to the server secret; x402 requirements are unsigned |
| "here's my payment" | **`PaymentPayload`** | **Credential** | both base64 JSON; MPP Credentials are single-use bearer tokens |
| "payment done" | **`SettlementResponse`** | **Receipt** | |
| payment semantics axis | **scheme** (`exact`, `upto`, `batch-settlement`, `auth-capture`*) | **intent** (`charge`, `session`, `subscription`) | *auth-capture is spec-stage |
| payment rail axis | **network** (CAIP-2: `eip155:8453`, `solana:…`) | **method** (`tempo`, `stripe`, `evm`, `card`, `lightning`, `solana`, `stellar`, `monad`, …) | x402 is chain-only; MPP methods include card rails |
| fixed one-shot payment | `exact` scheme | `charge` intent | "The x402 'exact' model maps cleanly onto MPP's `charge` intent" (mpp.dev) |
| cap-then-charge-actual | `upto` scheme (Permit2; settlement overrides) | — (no direct equivalent) | x402-only shape: single request, authorize max, settle actual |
| escrow + cumulative off-chain vouchers | `batch-settlement` scheme | `session` intent (TIP-1034 channels) | **the same construction independently arrived at** — see §4 |
| verification/settlement delegate | **facilitator** (`POST /verify`, `POST /settle`, `GET /supported`) | — (server verifies inline) | MPP's only "facilitator" mention is x402-interop config |
| payer identity | wallet address (`payer` in responses) | **`source`** (DID, e.g. `did:pkh:eip155:…`) | MPP `source` doubles as zero-dollar identity auth |
| wallet-auth-without-payment | **SIWX extension** (CAIP-122, `SIGN-IN-WITH-X` header) | zero-amount Challenge + `proof` payload | same job, different mechanics |
| discovery | **Bazaar** (facilitator-hosted `GET /discovery/resources`) | **OpenAPI 3.1 + `x-payment-info`** at `/openapi.json`, registries (MPPScan, mpp.dev/services) | MPP: "Discovery is advisory. The runtime 402 Challenge remains the authoritative source" |
| errors | ad-hoc string codes (`insufficient_funds`, …) | RFC 9457 Problem Details (`paymentauth.org/problems/*`) | |
| idempotent retry | `payment-identifier` extension | `Idempotency-Key` header | |
| streaming top-up signal | — | `payment-need-voucher` event (SSE) / `mpp` frame (WS) | x402 has no in-stream payment events |
| end-of-stream receipt | — | `payment-receipt` event (final SSE frame / WS frame) | |

### Session-specific vocabulary (MPP / TIP-1034)

These come from `draft-tempo-session-00` and are what agents reading MPP docs will search for:

- **Channel** — the payer↔payee payment relationship (`channelId`), holding a **deposit** in the
  TIP-1034 channel-reserve precompile (`0x4d5050…` — the prefix spells "MPP").
- **Voucher** — EIP-712-signed *cumulative* authorization (`Voucher(bytes32 channelId, uint96 cumulativeAmount)`);
  monotonically increasing, so replay-safe; server keeps only the highest.
- **Lifecycle actions** — `open`, `topUp`, `voucher`, `close` (Credential `payload.action`).
- **`amount` + `unitType`** — in a session Challenge, `amount` is the **price per unit** ("llm_token",
  "byte", "request"), *not* a total; `total = amount × units consumed`. Receipts carry `units`,
  `acceptedCumulative`, `spent`.
- **`suggestedDeposit`** — server's recommended escrow amount on the Challenge.
- **"tick"** — *SDK slang only*. mppx docs say "each yielded value … is charged one tick"; the word
  appears nowhere in the specs. The spec-level pair is `amount` (per-unit price) + `unitType`.

## 3. Where they overlap

1. **Same core UX**: request → 402 → pay → retry → resource, with all protocol data
   base64-encoded in headers and the body left to the application.
2. **Same target market**: agentic/machine-to-machine payments in stablecoins, no accounts or
   API keys, wallet-as-identity. Both publish agent-facing discovery surfaces and MCP integrations
   (x402: MCP transport spec + Bazaar tool listings; MPP: `_meta["org.paymentauth/credential"]`
   MCP binding + mpp.dev services MCP server).
3. **`exact` ≈ `charge`**: the fixed-price one-shot flow is semantically identical, and MPP's `evm`
   method will emit/accept both protocols' headers on one route when x402 interop is enabled.
4. **Wallet-auth entitlements**: x402's SIWX extension and MPP's zero-dollar `proof` Credentials
   both give "prove wallet ownership without paying" — the primitive under our `.siwx()` mode.
5. **Payment channels, twice**: see next section.

## 4. The deep similarity worth knowing: batch-settlement vs sessions

x402's `batch-settlement` scheme and MPP's Tempo `session` intent are **the same cryptographic
construction**: buyer deposits into on-chain escrow once, then signs *off-chain cumulative
vouchers* per request; the server verifies signatures locally (no RPC) and settles batches later.
x402 docs: "stateless unidirectional payment channels … signs off-chain cumulative vouchers for
each request." MPP spec: "unidirectional off-chain payment mechanism where the payer deposits
funds into an escrow contract and signs cumulative vouchers."

The difference is what's built *on top*:

| | x402 `batch-settlement` | MPP `session` |
|---|---|---|
| granularity | one voucher per **HTTP request** | one voucher covering **many units**, charged per unit/chunk |
| mid-stream billing | none — request-scoped | `payment-need-voucher` / `payment-receipt` events inside SSE/WS streams |
| chain support | EVM escrow contract | Tempo TIP-1034 precompile (protocol-enshrined), Solana, Lightning, Stellar ("channel" intent) |
| lifecycle verbs | deposit / claim / sweep / refund | `open` / `topUp` / `voucher` / `close` (+ forced close w/ 15-min grace) |

## 5. Where they differ

1. **Streaming and metering — the reason this router speaks both.** x402's `upto` spec *explicitly*
   lists "multi-settlement streaming, recurring payments, and open-ended allowances" as out of
   scope, and nothing else in x402 fills that hole (auth-capture is spec-stage). MPP's `session`
   intent + SSE/WS transports are a complete in-stream billing protocol: reserve per unit, pause
   delivery on exhausted headroom, emit `payment-need-voucher`, resume on a bigger voucher, final
   `payment-receipt` frame after the last chunk. This is why `.metered()`/`.stream()` are MPP-only.
2. **Facilitator vs inline.** x402 servers typically outsource `verify`/`settle` to a facilitator
   (permissionless, non-custodial, e.g. CDP's); MPP servers verify and settle themselves (which is
   why MPP session mode needs the payee's private key — `MPP_OPERATOR_KEY` — while x402 needs only
   a payee *address*).
3. **Rail scope.** x402 is blockchain-only (schemes are instantiated per chain: EVM EIP-3009/Permit2,
   Solana `TransferChecked`, TON, Stellar, …). MPP methods include non-chain rails: Stripe Shared
   Payment Tokens, Visa network tokens (`card`), Lightning BOLT11.
4. **Standards posture.** x402: Foundation-governed spec repo, versioned on the wire, custom headers.
   MPP: IETF standards track (`draft-ryan-httpauth-payment`), standard auth-scheme machinery,
   RFC 9457 errors, RFC 8785 canonical JSON, IANA registries for methods/intents.
5. **Challenge integrity.** MPP Challenges are HMAC-bound (server secret over
   `realm|method|intent|request|expires|digest|opaque`) and can bind to the request **body** via
   RFC 9530 Content-Digest. x402 payment requirements carry no server signature (the buyer's
   signature over amount/recipient is the integrity anchor).
6. **Subscriptions.** MPP has a `subscription` intent (authorize once, at most one charge per
   billing period) in production for `tempo`; x402's closest is the in-development `auth-capture`
   scheme ("subscription or session billing with periodic captures").

---

## 6. Router API ↔ protocol terminology

What `@agentcash/router` calls things, and what each protocol calls the same thing:

| Router surface | x402 concept | MPP concept | Alignment |
|---|---|---|---|
| `protocols: ['x402', 'mpp']` | — | — | ✓ |
| `.paid(price)` / billing `'exact'` | **`exact` scheme** | **`charge` intent** | billing mode name matches x402; method name matches neither |
| `.upTo(maxPrice)` / billing `'upto'` | **`upto` scheme** | — | ✓ exact match (x402-only, correctly) |
| `.metered({ tickCost, maxPrice, unitType })` / billing `'metered'` | — | **`session` intent** | ✗ mismatch — see below |
| `.stream(async function* …)` | — | session over the **SSE transport** | describes handler shape, not protocol |
| `charge()` in stream context | — | `stream.charge()` in mppx | ✓ matches the SDK |
| `charge(amount)` in upTo context | `upto` settlement amount | — | fine |
| `tickCost` | — | spec: **`amount` (price per unit)**; SDK slang: "tick" | ✗ "tick" isn't a spec term |
| `unitType` | — | **`unitType`** (session Challenge, §7.1) | ✓ exact match |
| `maxPrice` (metered) | — | — (nearest: client-side `maxDeposit`, server `suggestedDeposit`) | router-specific promise; MPP has no server-side total cap |
| `RouterConfig.mpp.session = {}` | — | `session` intent enablement | ✓ — but clashes with `.metered()` naming |
| `mpp.operatorKey` | — | **operator** (v2 descriptor) / payee signer | ✓ |
| `depositMultiplier` → challenge deposit | — | **`suggestedDeposit`** | ✓ concept match |
| `.siwx()` | **SIWX extension** (CAIP-122) | zero-dollar `proof` + `source` identity | ✓ matches x402's name |
| `.settlement({ beforeSettle, afterSettle })` | facilitator `settle` / lifecycle hooks (`onBeforeSettle`…) | server-side settlement | ✓ |
| 402 challenge headers emitted | `PAYMENT-REQUIRED` (x402 v2) | `WWW-Authenticate: Payment` | ✓ both, per protocol |

## 7. Router terminology: the confusion, and a proposal

### The problem

An agent that just read the MPP docs knows the words **session**, **amount per unit**, **unitType**,
**voucher**, **charge intent**. It lands in our codebase and finds:

- `.metered()` — a word neither protocol uses as a mode name. Worse, the *config* that enables it
  is literally `mpp.session = {}`, so our own API disagrees with itself: you enable **session**
  mode to unlock the **metered** builder method.
- `tickCost` — "tick" appears in mppx docs as slang but in **zero** spec documents. An agent
  cross-referencing the session spec finds `amount`/`unitType` and no ticks.
- `.stream()` — the MPP docs frame this as the SSE **transport** of a **session**; "stream" is a
  handler-shape word we invented (it is, at least, self-describing for what the handler returns).
- Meanwhile `.upTo()` and billing `'exact'` match x402's scheme names perfectly — proof that
  protocol-aligned naming was already the instinct here; `.metered()` is the outlier.

### Proposal (tiered)

**Tier 1 — rename the outliers, keep aliases (recommended; implemented — `.session()`/`unitCost` are now the primary names, `.metered()`/`tickCost` remain as deprecated aliases).**

1. **`.metered()` → `.session()`**, keeping `.metered()` as a deprecated alias for a major-version
   cycle. This makes the builder method agree with `RouterConfig.mpp.session`, the MPP intent
   name, and the mppx SDK (`tempo.session()`).
2. **`tickCost` → `unitCost`** (accept `tickCost` as deprecated alias). `unitCost` + `unitType`
   is self-explanatory as a pair ("what does one unit cost / what is a unit") and maps 1:1 to the
   spec's `amount` + `unitType` without colliding with our `.paid()` amounts.
   ```ts
   // before                                        // after
   .metered({ tickCost: '0.0001',                   .session({ unitCost: '0.0001',
              maxPrice: '0.05',                                maxPrice: '0.05',
              unitType: 'token' })                             unitType: 'token' })
   ```
3. **Keep `.stream()`** — it names the handler shape (async generator), which is genuinely what
   the user needs to know, and "session over SSE" is a docs concern. But document it in one line
   everywhere as: *"`.stream()` = the SSE transport of an MPP session; each `charge()` bills one
   unit (`unitCost`)."*
4. **Keep `.paid()` / `.upTo()`.** `.upTo()` already matches x402; `.paid()` is protocol-neutral
   (it spans x402 `exact` *and* MPP `charge`), and renaming it to `.charge()` would collide with
   the `charge()` handler-context function — a worse confusion than the one being fixed.
5. **Document `maxPrice` as router-level**, since agents won't find it in either spec: "a hard
   total-price ceiling enforced by the router (`CHARGE_OVER_CAP`); MPP itself only bounds spend by
   voucher headroom and deposit."

**Tier 2 — glossary in the discovery surface.** Our `/llms.txt` and `/openapi.json` outputs are
what *client* agents read. Emit the protocol terms there (`intent: session`, `amount`, `unitType`
per the MPP discovery spec's `x-payment-info`), never router-internal names. Add the §6 mapping
table above to the README and the `router-guide` skill so codegen agents can translate.

**Tier 3 — optional, aggressive (not recommended now).** Full protocol-native builder:
`.charge(price)`, `.chargeUpTo(max)`, `.session(opts)`. Maximal spec alignment, but breaks every
existing route file and introduces the `.charge()`-vs-`charge()` collision. Only worth it if we
ever do a clean 2.0 API.

### Why Tier 1 is enough

The dissonance agents actually hit is *within-ecosystem*: MPP docs say "session", our config says
`session`, but the method says `metered` — that's the trap. Fixing that one word (plus the
tick→unit vocabulary) makes every remaining router term either match a protocol term exactly
(`upto`, `exact`, `unitType`, `siwx`, `operator`) or be honestly router-scoped (`maxPrice`,
`.stream()`, `.paid()`), which a one-line doc note handles.
