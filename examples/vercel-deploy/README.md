# Deploy to Vercel · AgentCash Router

A standalone Next.js template that ships a pay-per-call API on **x402**, powered by [`@agentcash/router`](https://www.npmjs.com/package/@agentcash/router). Deploy in one click, customize the routes, and you have an agent-callable API on a custom domain.

The demo API is a fortune teller. Out of the box it exercises `.paid()`, `.upTo()`, `.paid(fn)` (body-derived pricing), `.siwx()`, and `.upTo().siwx()` (pay-once-then-replay). MPP streaming and request-mode billing are supported by `@agentcash/router` but require extra env vars and are not enabled by default — see [Enabling MPP](#enabling-mpp) below.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Ftree%2Fmain%2Fexamples%2Fvercel-deploy&project-name=agentcash-fortune-api&repository-name=agentcash-fortune-api&demo-title=AgentCash%20Router%20Fortune%20API&demo-description=Pay-per-call%20fortune%20API%20on%20x402&demo-url=https%3A%2F%2Fagentcash.dev&env=EVM_PAYEE_ADDRESS%2CCDP_API_KEY_ID%2CCDP_API_KEY_SECRET&envDescription=Wallet%20that%20receives%20payments%20%2B%20Coinbase%20Developer%20Platform%20API%20keys%20for%20the%20default%20x402%20facilitator.&envLink=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Fblob%2Fmain%2Fexamples%2Fvercel-deploy%2FREADME.md%23environment-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22upstash%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22protocol%22%3A%22storage%22%7D%5D&skippable-integrations=1)

The deploy button:

- **Clones only this directory** into a fresh repo in the user's GitHub (Vercel reads the `/tree/main/examples/vercel-deploy` segment of the URL and creates a standalone repo with just these files — the rest of `agentcash-router` is not cloned).
- Prompts for the three required env vars with inline help.
- Provisions an **Upstash Redis** store (skippable) — required for production-safe SIWX entitlements. Without a real KV store, in-memory state is per-Lambda-instance and pay-once-then-replay routes break at scale.
- Names the project `agentcash-fortune-api` (rename in the UI before deploying if you want).
- Auto-derives `BASE_URL` from `VERCEL_PROJECT_PRODUCTION_URL` — no manual step.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `EVM_PAYEE_ADDRESS` | yes | `0x…` address that receives x402 and MPP payments on Base mainnet. Canonicalized to lowercase. Zero-address is rejected. |
| `CDP_API_KEY_ID` | yes | Coinbase Developer Platform API key ID for the default EVM facilitator. Create at https://portal.cdp.coinbase.com. |
| `CDP_API_KEY_SECRET` | yes | Matching CDP secret. |
| `BASE_URL` | no | Origin URL used as the 402 realm, OpenAPI server URL, and MPP memo prefix. **On Vercel, leave unset** — this template auto-derives it from `VERCEL_PROJECT_PRODUCTION_URL`. Set explicitly only if you want to pin a custom domain. |
| `SOLANA_PAYEE_ADDRESS` | no | When set, the router also accepts Solana payments. `.upTo()` is Base-only and `.metered()` is MPP-only; Solana clients can only pay static-priced `.paid()` routes. |
| `MPP_SECRET_KEY`, `MPP_CURRENCY`, `TEMPO_RPC_URL` | no | Enable MPP (Tempo). Setting `MPP_SECRET_KEY` toggles MPP on. Public `rpc.tempo.xyz` returns 401 — use the authenticated URL. |
| `MPP_OPERATOR_KEY` | no | Enables MPP session mode (required for `.metered()` request and streaming routes). Must resolve to the same address as `EVM_PAYEE_ADDRESS`. |
| `MPP_FEE_PAYER_KEY` | no | Sponsors client gas for MPP channel open/topUp. Must differ from the operator address. Holding native Tempo gas is your responsibility. Omit to make clients pay their own gas — the right default. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | auto on Vercel | Vercel KV / Upstash credentials. Auto-injected when you attach the KV store via the deploy button. Without these, in-memory SIWX/MPP state lives per-Lambda-instance and breaks at scale. |

The deploy button only surfaces the three required vars by default. Add the optional MPP/Solana vars in the Vercel dashboard after the first deploy if you want to extend the rails.

## Local development

```bash
cp .env.example .env.local        # fill in EVM_PAYEE_ADDRESS, CDP_API_KEY_ID, CDP_API_KEY_SECRET, BASE_URL=http://localhost:3000
npm install
npm run dev                       # http://localhost:3000
```

The landing page at `/` lists every endpoint with a copy-pasteable `npx agentcash fetch` command. Use the [AgentCash CLI](https://agentcash.dev) (`npx agentcash`) for the smoothest local-testing experience — it handles wallet, payment, and SIWX signing for you.

## What's where

| File | Purpose |
|---|---|
| `lib/router.ts` | `createRouterFromEnv` call that reads env at boot. Edit the title, description, and `guidance` string here. |
| `lib/routes.ts` | Barrel that imports every route module — required so the discovery handlers see them. Add new routes to this list. |
| `app/api/fortune/*` | The demo endpoints. Each file leads with a comment explaining which payment mode it exercises. |
| `app/openapi.json/route.ts` | AgentCash Discovery — the OpenAPI 3.x spec with pricing extensions. |
| `app/.well-known/x402/route.ts` | x402-native discovery (separate from `/openapi.json`). |
| `app/llms.txt/route.ts` | LLM-readable guidance for agents that don't speak AgentCash Discovery natively. |
| `app/page.tsx` | The landing page you saw after deploying. |
| `next.config.ts` | Derives `BASE_URL` from Vercel system env vars when unset. |

## Enabling MPP

MPP (multi-payment protocol on Tempo) adds streaming and per-request metered billing on top of x402. To enable in this template:

1. Set `MPP_SECRET_KEY`, `MPP_CURRENCY`, `TEMPO_RPC_URL`, and `MPP_OPERATOR_KEY` in your Vercel project. `MPP_OPERATOR_KEY` must resolve to the same address as `EVM_PAYEE_ADDRESS`.
2. Copy `examples/fortune/app/api/fortune/llm/` and `examples/fortune/app/api/fortune/stream/` from the repo into this template's `app/api/fortune/`.
3. Add the imports to `lib/routes.ts`:
   ```ts
   import '@/app/api/fortune/llm/route';
   import '@/app/api/fortune/stream/route';
   ```
4. Push. The new routes appear in `/openapi.json` and `/.well-known/x402` automatically.

## Customizing for your own API

1. Replace the routes in `app/api/fortune/*` with your real endpoints. The minimum viable route is:
   ```ts
   import { router } from '@/lib/router';
   export const POST = router
     .route('my-endpoint')
     .paid('0.01')
     .handler(async () => ({ hello: 'world' }));
   ```
2. Add each new route file to `lib/routes.ts`.
3. Update the title, description, and `guidance` in `lib/router.ts` so the discovery doc reflects what you ship.
4. Push to GitHub. Vercel rebuilds and your `openapi.json` updates automatically.

## How agents discover your API

Once deployed, agents find your endpoints via:

- `https://<your-domain>/openapi.json` — AgentCash Discovery (OpenAPI 3.x + AgentCash extensions). Indexed by [AgentCash](https://agentcash.dev), [x402scan](https://x402scan.com), [MPPScan](https://mppscan.com), and anyone else who crawls the format.
- `https://<your-domain>/.well-known/x402` — native x402 discovery for clients that don't speak OpenAPI.
- `https://<your-domain>/llms.txt` — plain-English usage guidance.

No registration, no marketplace, no API keys. The spec is the contract.

## License

MIT. See the root [LICENSE](../../LICENSE).
