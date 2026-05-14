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

Expect: `"protocol": "x402"`, `"network": "base"`, a `transactionHash`. Route is `/api/fortune` with no `.paid({ dynamic: true })` → exact scheme.

### 2. x402 `upto` — dynamic price with EIP-2612 gas-sponsoring on Base

```bash
$CLI fetch http://localhost:3000/api/fortune/premium \
  --method POST -p x402 -b '{"category":"love"}'
```

Expect: `"protocol": "x402"`, `"network": "base"`, `"price": "up to $0.05"`, a `transactionHash`. Route is `.paid({ dynamic: true, tickCost, maxPrice, protocols: ['x402'] })` → upto + Permit2. The 402 challenge must carry `extra.facilitatorAddress` (provided by `getSupported()` from the CDP facilitator); if you see `upto scheme requires facilitatorAddress in paymentRequirements.extra`, the server lost the `getSupported()` enrichment.

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

Expect: `"protocol": "mpp"`, `"network": "tempo"`, a `channelId` (no `transactionHash` — settlement is deferred until channel close). Route is `.paid({ dynamic: true, tickCost: '0.001', unitType: 'request' })`.

**Known race:** first call after a long gap can fail with `Channel not found: channel not funded on-chain`. The CLI opens the channel and immediately tries to use it before the on-chain funding tx lands. Wait ~8s and retry — once the channel is funded, subsequent calls reuse it.

### 5. MPP session, SSE streaming

```bash
$CLI fetch http://localhost:3000/api/fortune/stream \
  --method POST -b '{"prompt":"What awaits me?"}' --stream
```

Expect: `"protocol": "mpp"`, a `channelId`, and a concatenated stream of `{"event":"prompt"}`, ~9 `{"event":"token"}` lines, and one trailing `{"event":"done"}`. Route is `.paid({ dynamic: true, unitType: 'token', protocols: ['mpp'] }).stream(async function*)` — billed per `charge()` call inside the generator.

## Solana variant

The example also advertises Solana in `x402.accepts` when `SOLANA_PAYEE_ADDRESS` is set. Solana support is narrower than Base/Tempo: **only x402 `exact` (static-priced) and SIWX work** — `upto` is Base-only and MPP is Tempo-only, so tests 2/3/4/5 above have no Solana counterpart.

Force the wallet onto Solana with `--payment-network solana`. Fund the Solana account first (`$CLI list-accounts` shows the deposit link).

### S1. x402 `exact` on Solana

```bash
$CLI fetch http://localhost:3000/api/fortune --method POST -p x402 --payment-network solana
```

Expect: `"protocol": "x402"`, `"network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"`, a `transactionHash`. The 402 challenge's Solana accepts entry must include `extra.feePayer`, `recentBlockhash`, `decimals`, and `tokenProgram` — the client signs against that feePayer and the facilitator co-signs.

**Watch for:** `Payment rejected (invalid_payload): feePayer not managed: <address>`. That means the server advertised a feePayer the configured Solana facilitator doesn't sign for — usually a mismatch between the facilitator that answered `getSupported()` (quote time) and the one handling `/settle` (settle time). Check `src/protocols/x402/solana.ts` and the facilitator wiring in `src/protocols/x402/facilitator-clients.ts`.

### S2. SIWX identity on Solana

```bash
$CLI fetch http://localhost:3000/api/fortune/profile --payment-network solana
```

Expect: `{"wallet": "<base58 Solana address>", "message": "Identity verified via Sign-In with X"}` and **no payment**. The 402 challenge's `extensions.sign-in-with-x.supportedChains` must include `{chainId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", type: "ed25519"}`. If you get an EVM address back, the CLI fell through to Base — the `--payment-network solana` flag was ignored or the route's supported chains are misconfigured.

## Reporting back

Summarize as a table: test #, endpoint, protocol/network, pass/fail, tx hash or channel id. Note any retries needed (test 4's funding race is the only expected flake).

If a test fails with a payload/auth error, re-run `$CLI check <url>` to confirm the schema and required protocol — server-side route shape may have changed.
