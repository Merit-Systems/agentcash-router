# MPP Native Example

Minimal Next.js app using `mppx/nextjs` middleware directly — no `@agentcash/router`.

Demonstrates two payment intents:
- **Charge** — one-time payment per request (`/api/fortune`)
- **Session** — pay-as-you-go with off-chain vouchers (`/api/sessions/explore`)

## Quick Start

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

3. **Start dev server**
   ```bash
   pnpm dev
   ```

4. **Test the charge endpoint** (one-time payment)
   ```bash
   npx mppx http://localhost:3003/api/fortune --method POST
   ```

5. **Test the session endpoint** (pay-as-you-go)
   ```bash
   # First request opens a payment channel and deposits funds.
   # Subsequent requests send off-chain vouchers — no on-chain tx, near-zero latency.
   npx mppx "http://localhost:3003/api/sessions/explore?x=0&y=0"
   npx mppx "http://localhost:3003/api/sessions/explore?x=1&y=0"
   npx mppx "http://localhost:3003/api/sessions/explore?x=0&y=1"
   ```

## Endpoints

### `POST /api/fortune` — Charge (one-time payment)

Pays $0.001 per request. Returns a random fortune cookie message.

Good for: single API calls, content access, one-off purchases.

### `GET /api/sessions/explore?x=0&y=0` — Session (pay-as-you-go)

Reveals a procedurally generated map tile at the given coordinates. Each tile costs $0.001.

This is the use case sessions are built for — an agent exploring the map would naturally make 50-100 rapid requests in a burst. With charges, that's 50-100 on-chain transactions (~500ms overhead each, $0.001 gas each). With sessions, it's one deposit + instant off-chain vouchers (microseconds per request, amortized gas).

## Error Scenarios to Test

1. **No TEMPO_RPC_URL** — Comment out `TEMPO_RPC_URL` in `.env.local` and send a valid MPP credential
2. **Bad credential** — Send a malformed credential header
3. **No MPP_SECRET_KEY** — Remove `MPP_SECRET_KEY` and restart (falls back to random key)
