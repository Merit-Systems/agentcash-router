# MPP Native Example

Minimal Next.js app using `mppx/nextjs` middleware directly — no `@agentcash/router`.

This example exists to compare how `mppx` handles error cases (missing TEMPO_RPC_URL, bad credentials) natively vs through the router's integration.

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

4. **Test the endpoint**
Set your env var:

   `export RPC_URL = xxx`

   ```bash
   npx mppx http://localhost:3003/api/fortune --method POST
   ```

## Error Scenarios to Test

1. **No TEMPO_RPC_URL** — Comment out `TEMPO_RPC_URL` in `.env.local` and send a valid MPP credential
2. **Bad credential** — Send a malformed credential header
3. **No MPP_SECRET_KEY** — Remove `MPP_SECRET_KEY` and restart
