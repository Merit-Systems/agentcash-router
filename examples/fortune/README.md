# Fortune Example

Minimal Next.js app exercising every transaction kind `@agentcash/router` supports — `.paid()` fixed (x402 exact / MPP one-shot), `.upTo()` (x402 handler-driven), `.metered()` request-mode (MPP session), `.metered().stream()` (MPP session SSE), `.paid(fn)` (args-derived pricing), and `.siwx()` (identity).

Each route is self-contained: the top-of-file comment names the payment method it tests and shows the exact `agentcash` CLI command. To smoke-test every kind in order, see [`AGENTCASH_TESTS.md`](./AGENTCASH_TESTS.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # then edit with your keys
pnpm dev                      # http://localhost:3000
```

## Endpoint → payment method map

| Endpoint                 | Method     | Pricing mode                                            | Payment kind                                       | agentcash flag       |
| ------------------------ | ---------- | ------------------------------------------------------- | -------------------------------------------------- | -------------------- |
| `/api/fortune`           | POST       | `.paid('0.001')`                                        | x402 exact (Base) or MPP one-shot (Tempo)          | `-p x402` / `-p mpp` |
| `/api/fortune/premium`   | POST       | `.upTo('0.005')`                                        | x402 upto — handler-driven, EIP-2612 gas-sponsored | `-p x402`            |
| `/api/fortune/llm`       | POST       | `.metered({ tickCost, unitType: 'request' })`           | MPP session, request-mode                          | `-p mpp`             |
| `/api/fortune/stream`    | POST       | `.metered({ tickCost, unitType: 'token' }).stream(...)` | MPP session, SSE streaming                         | `--stream`           |
| `/api/fortune/dynamic`   | POST       | `.paid(fn, { maxPrice })`                               | Args-derived pricing (x402 / MPP)                  | auto                 |
| `/api/fortune/favorites` | POST / GET | `.siwx()`                                               | SIWX (Sign-In-with-X, no payment)                  | auto                 |
| `/api/fortune/profile`   | GET        | `.siwx()`                                               | SIWX (Sign-In-with-X, no payment)                  | auto                 |
| `/openapi.json`          | GET        | —                                                       | OpenAPI spec                                       | n/a                  |
| `/llms.txt`              | GET        | —                                                       | Agent guidance (`discovery.guidance`)              | n/a                  |

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
