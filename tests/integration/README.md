# tests/integration

End-to-end smoke tests that drive a real `@agentcash/router` server with a real client SDK. Not vitest tests; they are tsx scripts (the filenames use `test-*.ts`, not `*.test.ts`, so vitest skips them).

These require:
- The `examples/fortune` dev server running locally
- Real env: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, MPP wallet keys
- For on-chain settlement paths: a funded client wallet on Base (USDC + Permit2) or Tempo (USDC)

Without funds, the scripts run as far as the facilitator handoff and report what the facilitator returned. Useful for shaping changes without paying gas.

| File | Exercises |
|------|-----------|
| `test-x402-exact-upto.ts` | x402 `exact` (static price) and `upto` (dynamic, settle ≤ maxPrice) |
| `test-session-alignment.ts` | MPP session lifecycle: open, multi-request channel reuse, streaming, close |

## Run

```bash
# Terminal 1
cd examples/fortune
pnpm dev

# Terminal 2 (from repo root)
pnpm tsx tests/integration/test-x402-exact-upto.ts
pnpm tsx tests/integration/test-session-alignment.ts
```
