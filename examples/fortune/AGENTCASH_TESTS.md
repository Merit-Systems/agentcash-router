# Agent prompt: smoke-test every transaction type via agentcash

You are testing `@agentcash/router` against the fortune example. Your goal is to confirm that **one of each kind of paid transaction** works end-to-end through the `agentcash` CLI.

## Preconditions

1. Dev server is running: `pnpm dev` in `examples/fortune` listening on `http://localhost:3000`.
2. If the router was rebuilt, the dev server has been restarted (Next won't hot-reload a linked dependency).
3. Pin a CLI version that's known to talk to the current server. Use whatever the user names; if none, default to:
   ```bash
   CLI="npx agentcash@latest"
   ```
   Treat `$CLI` as the command in every test below.
4. Wallet has funds on **Base** (for x402) and **Tempo** (for MPP). Check:
   ```bash
   $CLI balance
   ```

## Five tests (one per transaction kind)

Run them in order. Each is independent — if one fails, keep going and report which.

### 1. x402 `exact` — fixed price, one-shot on Base

```bash
$CLI fetch http://localhost:3000/api/fortune --method POST -p x402
```

Expect: `"protocol": "x402"`, `"network": "base"`, a `transactionHash`. Route is `/api/fortune` with `.paid('0.001')` → exact scheme.

### 2. x402 `upto` — dynamic price with EIP-2612 gas-sponsoring on Base

```bash
$CLI fetch http://localhost:3000/api/fortune/premium \
  --method POST -p x402 -b '{"category":"love"}'
```

Expect: `"protocol": "x402"`, `"network": "base"`, `"price": "up to $0.005"`, a `transactionHash`. Route is `.upTo('0.005')` with the handler calling `charge(amount)` → upto + Permit2. The 402 challenge must carry `extra.facilitatorAddress` (provided by `getSupported()` from the CDP facilitator); if you see `upto scheme requires facilitatorAddress in paymentRequirements.extra`, the server lost the `getSupported()` enrichment.

### 3. MPP one-shot — fixed price, no session

```bash
$CLI fetch http://localhost:3000/api/fortune --method POST -p mpp
```

Expect: `"protocol": "mpp"`, `"network": "tempo"`, `"price": "$0.001"`, a `transactionHash`. Same route as test 1, but forced onto MPP.

### 4. MPP session, request-mode

```bash
$CLI fetch http://localhost:3000/api/fortune/llm \
  --method POST -p mpp -b '{"prompt":"Will I find love?"}'
```

Expect: `"protocol": "mpp"`, `"network": "tempo"`, a `channelId` (no `transactionHash` — settlement is deferred until channel close). Route is `.session({ unitCost: '0.001', maxPrice: '0.01', unitType: 'request' })` — `.handler()` (non-generator) bills exactly `unitCost` per request.

**Known race:** first call after a long gap can fail with `Channel not found: channel not funded on-chain`. The CLI opens the channel and immediately tries to use it before the on-chain funding tx lands. Wait ~8s and retry — once the channel is funded, subsequent calls reuse it.

### 5. MPP session, SSE streaming

```bash
$CLI fetch http://localhost:3000/api/fortune/stream \
  --method POST -b '{"prompt":"What awaits me?"}' --stream
```

Expect: `"protocol": "mpp"`, a `channelId`, and a concatenated stream of `{"event":"prompt"}`, ~9 `{"event":"token"}` lines, and one trailing `{"event":"done"}`. Route is `.session({ unitCost: '0.0001', maxPrice: '0.05', unitType: 'token' }).stream(async function*)` — each `charge()` call inside the generator bills one unit.

### 6. x402 `upto` + SIWX entitlement — pay once, replay free

Tests `.upTo('0.005').siwx()` — the first call pays via x402, settles on chain, and grants a SIWX entitlement to the paying wallet. The second call from the same wallet presents a SIWX signature instead of a payment and runs the handler for free. The handler's `charge('0.002')` accumulates real billing on the first call; on the SIWX replay it's a no-op (server-side fast path drops it).

**First call — pay:**

```bash
$CLI fetch http://localhost:3000/api/fortune/membership --method POST -p x402
```

Expect: `"protocol": "x402"`, `"network": "base"`, a `transactionHash`, and the response includes a `wallet` address. Server has now written `('fortune/membership', <wallet>)` to the entitlement KV.

**Second call — same wallet, no payment:**

```bash
$CLI fetch http://localhost:3000/api/fortune/membership --method POST
```

Expect: `200 OK`, **no `transactionHash`**, same `wallet` echoed back. `agentcash fetch` defaults to "auth before payment", so it presents the SIWX signature; the server's `trySiwxFastPath` matches the entitlement and runs the handler without re-settling.

**Verifying the no-op charge:** the handler returns `200` even though it calls `await charge('0.002')` on the replay. If charge were unhandled on the SIWX fast path, the response would be a 500 (`charge is not a function`). Seeing the response body confirms the no-op wiring in `src/pipeline/flows/static/static-invoke.ts`.

**Resetting between runs:** the entitlement is keyed by route + wallet and persists for the KV TTL (in-memory by default, ~24h on Upstash/Vercel KV). To re-test the paid path with the same wallet, restart the dev server (in-memory KV resets) or use a fresh wallet.

## Solana variant

The example also advertises Solana in `x402.accepts` when `SOLANA_PAYEE_ADDRESS` is set. Solana support is narrower than Base/Tempo: **only x402 `exact` (static-priced) and SIWX work** — `upto` is Base-only and MPP is Tempo-only, so tests 2/3/4/5 above have no Solana counterpart.

Force the wallet onto Solana with `--payment-network solana`. Fund the Solana account first (`$CLI accounts` shows the deposit link).

### S1. x402 `exact` on Solana

```bash
$CLI fetch http://localhost:3000/api/fortune --method POST -p x402 --payment-network solana
```

Expect: `"protocol": "x402"`, `"network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"`, a `transactionHash`. The 402 challenge's Solana accepts entry must include `extra.feePayer` (merged from the facilitator's `GET /supported` kinds) — the client builds the transaction with a fresh recent blockhash from RPC, signs against that feePayer, and the facilitator co-signs. The challenge no longer carries per-request fields like `recentBlockhash`; static extras (`decimals`, `tokenProgram`) appear only if the facilitator advertises them on its `/supported` kind.

**Watch for:** `Payment rejected (invalid_payload): feePayer not managed: <address>`. That means the server advertised a feePayer the configured Solana facilitator doesn't sign for — usually a mismatch between the facilitator that answered `getSupported()` (quote time) and the one handling `/settle` (settle time). Check `src/protocols/x402/solana.ts` and the facilitator wiring in `src/protocols/x402/facilitator-clients.ts`.

### S2. SIWX identity on Solana

```bash
$CLI fetch http://localhost:3000/api/fortune/profile --payment-network solana
```

Expect: `{"wallet": "<base58 Solana address>", "message": "Identity verified via Sign-In with X"}` and **no payment**. The 402 challenge's `extensions.sign-in-with-x.supportedChains` must include `{chainId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", type: "ed25519"}`. If you get an EVM address back, the CLI fell through to Base — the `--payment-network solana` flag was ignored or the route's supported chains are misconfigured.

## Bonus: mppx's own validator

mppx ≥0.8.4 ships an end-to-end validator that discovers paid endpoints, checks challenge shape, exercises malformed-credential handling, and runs real Tempo payment flows:

```bash
npx mppx@latest validate http://localhost:3000/api/fortune
```

Useful as a second opinion when a CLI test above fails — it distinguishes "server emitted a bad challenge" from "client couldn't pay it".

## Reporting back

Summarize as a table: test #, endpoint, protocol/network, pass/fail, tx hash or channel id. Note any retries needed (test 4's funding race is the only expected flake).

If a test fails with a payload/auth error, re-run `$CLI check <url>` to confirm the schema and required protocol — server-side route shape may have changed.
