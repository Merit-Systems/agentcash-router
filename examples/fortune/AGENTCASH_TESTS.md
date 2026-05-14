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

## Reporting back

Summarize as a table: test #, endpoint, protocol/network, pass/fail, tx hash or channel id. Note any retries needed (test 4's funding race is the only expected flake).

If a test fails with a payload/auth error, re-run `$CLI check <url>` to confirm the schema and required protocol — server-side route shape may have changed.
