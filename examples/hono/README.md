# Hono Example

`@agentcash/router` on a plain Hono + Node server — no Next.js. The router's internal Hono app (`router.hono()`) is mounted into a host app and served with `@hono/node-server`. One paid route (`POST /api/quote`, $0.001), one free route (`GET /api/health`) with a `.nextStep()` edge, and the discovery surfaces (`/.well-known/x402`, `/openapi.json`, `/llms.txt`) for free.

## Run

```bash
pnpm install

export BASE_URL=http://localhost:3000          # 402 realm + OpenAPI server URL
export EVM_PAYEE_ADDRESS=0x...                 # receives x402 payments (Base USDC)
export CDP_API_KEY_ID=...                      # Coinbase Developer Platform key
export CDP_API_KEY_SECRET=...                  #   (free tier: portal.cdp.coinbase.com)

pnpm dev                                       # http://localhost:3000
```

Test with the [AgentCash CLI](https://agentcash.dev):

```bash
curl http://localhost:3000/api/health
npx agentcash fetch http://localhost:3000/api/quote --method POST -b '{"topic":"code"}'
```
