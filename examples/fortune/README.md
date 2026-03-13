# Fortune Example

Minimal Next.js app demonstrating `@agentcash/router` with both x402 and MPP payment protocols.

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
   ```bash
   # Get challenge (402)
   curl -i -X POST http://localhost:3000/api/fortune

   # With agentcash MCP
   await mcp__agentcash__fetch({
     url: 'http://localhost:3000/api/fortune',
     method: 'POST',
     paymentMethod: 'mpp',  // or 'x402'
   });
   ```

## Endpoints

- `POST /api/fortune` - Get a random fortune ($0.001, x402/MPP)
- `POST /api/fortune/premium` - Premium fortune by category ($0.005, x402/MPP)
- `GET /api/fortune/profile` - Verified wallet identity (SIWX only; EVM + Solana)
- `POST /api/fortune/favorites` - Save a favorite fortune (SIWX)
- `GET /api/fortune/favorites` - List saved favorites (SIWX)
- `GET /.well-known/x402` - Discovery endpoint
- `GET /openapi.json` - OpenAPI spec
- `GET /llms.txt` - Agent guidance (from `discovery.guidance`)

## Solana + SIWX

SIWX routes (profile, favorites) accept both **EVM (Base)** and **Solana** wallets. The router derives `supportedChains` from `x402.accepts`, so configuring both `eip155:8453` and `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` accepts enables dual-chain SIWX. Use `GET /api/fortune/profile` to verify wallet identity with no payment.

## Testing MPP

To test MPP payments:

1. Set `MPP_SECRET_KEY` in `.env.local` (64-char hex string)
2. Use `paymentMethod: 'mpp'` in MCP fetch
3. Check console for `[MPP]` logs showing credential flow

## Fast Iteration

This example uses `"@agentcash/router": "file:../.."` to link directly to the parent router source. After making changes to the router:

```bash
# Rebuild router
cd ../..
pnpm build

# Reinstall in example (picks up changes)
cd examples/fortune
rm -rf node_modules/.cache
pnpm install --force

# Restart dev server
pnpm dev
```
