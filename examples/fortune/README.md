# Fortune Example

Minimal Next.js app exercising every transaction kind `@agentcash/router` supports — `.paid()` fixed (x402 exact / MPP one-shot), `.upTo()` (x402 handler-driven), `.upTo().siwx()` (pay once, replay free), `.metered()` request-mode (MPP session), `.metered().stream()` (MPP session SSE), `.paid(fn)` (args-derived pricing), `.siwx()` (identity), and a `.nextStep()` workflow edge.

All routes are registered in one module, [`lib/routes.ts`](./lib/routes.ts), and served by a single Next.js optional catch-all, [`app/api/[[...route]]/route.ts`](./app/api/[[...route]]/route.ts). Each registration leads with a comment naming the payment method it tests and the exact `agentcash` CLI command. To smoke-test every kind in order, see [`AGENTCASH_TESTS.md`](./AGENTCASH_TESTS.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # then edit with your keys
pnpm dev                      # http://localhost:3000
```

## Hosting pattern

The router is framework-agnostic (Web-standard `Request`/`Response`); the Next.js adapter is a one-liner:

```ts
// app/api/[[...route]]/route.ts
import '@/lib/routes'; // side-effect import: registers all routes
import { router } from '@/lib/router';
import { nextHandlers } from '@agentcash/router/next';

export const { GET, POST, PUT, PATCH, DELETE } = nextHandlers(router);
```

The catch-all covers `/api/*` only. The root discovery surfaces — `/.well-known/x402`, `/openapi.json`, `/llms.txt` — each get their own small route file under `app/` (the alternative is a middleware rewrite into the catch-all; both options are documented on `nextHandlers`).

## Endpoint → payment method map

| Endpoint                  | Method     | Pricing mode                                            | Payment kind                                       | agentcash flag       |
| ------------------------- | ---------- | ------------------------------------------------------- | -------------------------------------------------- | -------------------- |
| `/api/fortune`            | POST       | `.paid('0.001')`                                        | x402 exact (Base) or MPP one-shot (Tempo)          | `-p x402` / `-p mpp` |
| `/api/fortune/premium`    | POST       | `.upTo('0.005')`                                        | x402 upto — handler-driven, EIP-2612 gas-sponsored | `-p x402`            |
| `/api/fortune/membership` | POST       | `.upTo('0.005').siwx()`                                 | Pay once via x402, replay free with SIWX           | `-p x402`, then auto |
| `/api/fortune/llm`        | POST       | `.metered({ tickCost, unitType: 'request' })`           | MPP session, request-mode                          | `-p mpp`             |
| `/api/fortune/stream`     | POST       | `.metered({ tickCost, unitType: 'token' }).stream(...)` | MPP session, SSE streaming                         | `--stream`           |
| `/api/fortune/dynamic`    | POST       | `.paid(fn, { maxPrice })`                               | Args-derived pricing (x402 / MPP)                  | auto                 |
| `/api/fortune/favorites`  | POST / GET | `.siwx()`                                               | SIWX (Sign-In-with-X, no payment)                  | auto                 |
| `/api/fortune/profile`    | GET        | `.siwx()`                                               | SIWX (Sign-In-with-X, no payment)                  | auto                 |
| `/.well-known/x402`       | GET        | —                                                       | Discovery (+ `workflows` from `.nextStep()`)       | auto                 |
| `/openapi.json`           | GET        | —                                                       | OpenAPI spec (also at `/api/openapi.json`)         | n/a                  |
| `/llms.txt`               | GET        | —                                                       | Agent guidance (+ `## Workflows` section)          | n/a                  |

## Workflow chaining (`.nextStep()`)

`/api/fortune` declares a `.nextStep()` edge pointing at `/api/fortune/premium`. Successful JSON responses gain a structured `next` array:

```json
{
  "fortune": "A fresh start will put you on your way.",
  "next": [
    {
      "method": "POST",
      "url": "http://localhost:3000/api/fortune/premium",
      "auth": "paid",
      "price": "0.005",
      "body": { "category": "love" },
      "note": "Want a deeper reading? Premium fortunes are metered up to $0.005."
    }
  ]
}
```

The same edge surfaces statically as `workflows` in `/.well-known/x402`, OpenAPI `links` + `x-next` in `/openapi.json`, and a `## Workflows` section in `/llms.txt`.

## SIWX dual-chain

The SIWX routes accept both **EVM (Base)** and **Solana** wallets. The router derives `supportedChains` from `x402.accepts`, so configuring both `eip155:8453` and a Solana cluster enables dual-chain SIWX. `GET /api/fortune/profile` is the simplest way to verify wallet identity with no payment.

## Fast iteration

The example uses `"@agentcash/router": "link:../.."` to consume the package from source. After editing router code:

```bash
# from repo root
pnpm build

# in examples/fortune
rm -rf node_modules/.cache
pnpm install --force
pnpm dev   # restart — Next won't hot-reload a linked dependency
```
