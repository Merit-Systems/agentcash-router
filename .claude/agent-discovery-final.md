# agentcash Discovery & Interaction Pipeline

agentcash provides a progressive discovery-to-invocation pipeline for paid API endpoints. Agents discover what's available, inspect pricing and schemas, then invoke with automatic payment — all through MCP tools.

## Supported Protocols

| Protocol | Network | Payment Header | Settlement |
| -------- | ------- | -------------- | ---------- |
| **x402** | Base (USDC) + EVM chains | `payment-required` in 402 response | On-chain EVM transaction |
| **MPP** | Tempo (sidechains) | `WWW-Authenticate: Payment` in 402 response | Tempo chain credential |

Both protocols follow the same lifecycle: probe, get rejected with a 402, pay, retry.

---

## Lifecycle

```
Phase 0          Phase 1              Phase 2                Phase 3
Origins    →     Discover Origin  →   Schema Discovery   →   Fetch with Payment
(known set)      (fan out)            (point query)          (quote + invoke)
```

### Phase 0: Known Origins

Origins are currently hardcoded in `src/shared/origins.ts` and injected into the MCP tool description. Users can also bring their own origin by passing any URL to `discover_api_endpoints`.

| Origin | Description |
| ------ | ----------- |
| `enrichx402.com` | People/org search, Google Maps, Grok, Exa, Clado, Firecrawl, WhitePages, email enrichment, Hunter |
| `socialx402.com` | Twitter, Instagram, TikTok, YouTube, Facebook, Reddit |
| `stablestudio.io` | Image/video generation and editing |
| `agentupload.dev` | File upload and sharing |
| `x402email.com` | Email sending |

### Phase 1: Discover Origin (`discover_api_endpoints`)

Fan-out discovery for a given origin. Fetches the OpenAPI spec and `llms.txt` in parallel.

**OpenAPI spec resolution** — tries these URLs in order:
1. `{origin}/openapi.json`
2. `{origin}/.well-known/openapi.json`
3. `{origin}/.well-known/x402`
4. `{origin}/.well-known/mpp`

**`llms.txt`** — fetched from `{origin}/llms.txt` (best-effort, non-blocking). Returns natural language instructions for the agent.

**Output**: A lightweight endpoint index — just `path`, `summary`, and `price` per operation. The full spec is cached in memory but not returned, to avoid context bloat.

```json
{
  "found": true,
  "origin": "https://enrichx402.com",
  "endpoints": [
    { "path": "/api/apollo/people/search", "summary": "Search for people", "price": "$0.02" },
    { "path": "/api/exa/search", "summary": "Neural web search", "price": "$0.04" }
  ],
  "instructions": "..."
}
```

Pricing and protocol hints come from `x-payment-info` in the OpenAPI spec:
```yaml
x-payment-info:
  price: 0.02
  protocols: ["x402", "mpp"]
```

### Phase 2: Schema Discovery (`check_endpoint_schema`)

Point query for a specific endpoint. Returns full schema, pricing, and payment method details.

**Two-tier resolution:**

1. **OpenAPI cache (fast, no network)** — if the spec was already fetched during Phase 1, the schema is resolved locally with `$ref` resolution (max depth 4).

2. **402 probe (fallback)** — makes an actual request to the endpoint. If it returns 402, parses the payment challenge to extract pricing and protocol details. If it returns 200, reports `requiresPayment: false`.

**Output**:
```json
{
  "requiresPayment": true,
  "protocols": ["x402", "mpp"],
  "paymentMethods": [
    {
      "protocol": "x402",
      "price": 0.02,
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "schema": { ... }
    },
    {
      "protocol": "mpp",
      "price": 0.02,
      "method": "tempo",
      "intent": "payment",
      "realm": "...",
      "network": "tempo:tempo",
      "schema": { ... }
    }
  ]
}
```

### Phase 3: Fetch with Payment (`fetch`)

Invoke an endpoint with automatic payment handling.

**Flow:**
```
1. Send request
2. If 200 → return response (no payment needed)
3. If 402 → detect available protocols from response headers
4. Protocol selection:
   - User specified x402 or mpp → use that, no fallback
   - Auto → compare wallet balances, pick higher balance
5. Create payment (sign transaction)
6. Retry request with payment headers
7. Verify settlement / parse receipt
8. Return response + payment info (price, tx hash)
```

**Protocol detection** from 402 response headers:
- `payment-required` header → x402
- `WWW-Authenticate: Payment` header → MPP
- Neither detected → defaults to x402

**Auto-fallback**: when `paymentMethod: "auto"` (default) and both protocols are available, if the preferred protocol fails, the fetch automatically retries with the other protocol.

**Balance checks**: before signing a payment, the tool checks the wallet balance. If the MCP client supports elicitation, the user is prompted to confirm. If the balance is insufficient, the tool returns an error with a deposit link.

---

## Tools Summary

| Tool | Phase | Description |
| ---- | ----- | ----------- |
| `get_wallet_info` | — | Get wallet address and USDC balance. Auto-creates wallet on first use. |
| `redeem_invite` | — | Redeem an invite code for free USDC on Base. |
| `discover_api_endpoints` | 1 | Discover endpoints on an origin via OpenAPI spec + llms.txt. |
| `check_endpoint_schema` | 2 | Get pricing, schema, and payment methods for a specific endpoint. |
| `fetch` | 3 | HTTP fetch with automatic payment (x402 or MPP). |
| `fetch_with_auth` | 3 | HTTP fetch with automatic SIWX (Sign-In With X) authentication. |
| `report_error` | — | Report critical MCP tool bugs. |

---

## Caching

- **OpenAPI specs**: cached in memory per origin after first fetch. Shared between `discover_api_endpoints` and `check_endpoint_schema`.
- **Endpoint index**: lightweight `path + summary + price` array, built lazily from the spec and cached per origin.
- **Schema resolution**: `$ref` pointers are resolved at query time with max depth of 4 to prevent context bloat.
