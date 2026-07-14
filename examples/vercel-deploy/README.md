# Deploy to Vercel · AgentCash Router

A standalone Next.js template that ships a pay-per-call API on **x402** and **MPP**, powered by [`@agentcash/router`](https://www.npmjs.com/package/@agentcash/router). Deploy in one click, customize the routes, and you have an agent-callable API on a custom domain.

The demo API is a fortune teller. Every router pricing mode is exercised: `.paid()` fixed-price, `.upTo()` handler-driven, `.paid(fn)` body-derived, `.session()` request and streaming (MPP), `.siwx()` identity, and `.upTo().siwx()` pay-once-then-replay. x402 and one-shot MPP both work the moment you deploy — `.paid()` routes accept `-p x402` (Base) or `-p mpp` (Tempo), client's choice. MPP _session_ routes (metered request + streaming) 503 until you set `MPP_OPERATOR_KEY` — one extra env var flips them on. See [Enabling MPP session routes](#enabling-mpp-session-routes) below.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Ftree%2Fmain%2Fexamples%2Fvercel-deploy&project-name=agentcash-fortune-demo&repository-name=agentcash-fortune-demo&demo-title=AgentCash%20Router%20Fortune%20Demo&demo-description=Pay-per-call%20fortune%20API%20on%20x402%20and%20MPP&demo-url=https%3A%2F%2Fagentcash.dev&env=EVM_PAYEE_ADDRESS%2CCDP_API_KEY_ID%2CCDP_API_KEY_SECRET&envDescription=Wallet%20that%20receives%20payments%20%2B%20Coinbase%20Developer%20Platform%20API%20keys%20for%20the%20default%20x402%20facilitator.%20Create%20keys%20in%20the%20generous%20CDP%20free%20tier%3A%20https%3A%2F%2Fportal.cdp.coinbase.com%2Fprojects%2Fapi-keys&envLink=https%3A%2F%2Fgithub.com%2FMerit-Systems%2Fagentcash-router%2Fblob%2Fmain%2Fexamples%2Fvercel-deploy%2FREADME.md%23environment-variables)

The deploy button:

- **Clones only this directory** into a fresh repo in the user's GitHub (Vercel reads the `/tree/main/examples/vercel-deploy` segment of the URL and creates a standalone repo with just these files — the rest of `agentcash-router` is not cloned).
- Prompts for the three required env vars with inline help. Create the CDP API keys in Coinbase's generous free tier at https://portal.cdp.coinbase.com/projects/api-keys.
- Keeps the first deploy focused on the required x402 configuration. Add **Upstash Redis** / Vercel KV after deploy from the Vercel Storage tab for production-safe SIWX entitlements; without a real KV store, in-memory state is per-Lambda-instance and pay-once-then-replay routes break at scale.
- Names the project `agentcash-fortune-demo` (rename in the UI before deploying if you want).
- `@agentcash/router` auto-derives `BASE_URL` from `VERCEL_PROJECT_PRODUCTION_URL` — no manual step.

## Environment variables

| Variable                                          | Required                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVM_PAYEE_ADDRESS`                               | yes                        | `0x…` address that receives x402 and MPP payments on Base mainnet. Canonicalized to lowercase. Zero-address is rejected.                                                                                                                                                                                                                                                                       |
| `CDP_API_KEY_ID`                                  | yes                        | Coinbase Developer Platform API key ID for the default EVM facilitator. Create keys in the generous CDP free tier at https://portal.cdp.coinbase.com/projects/api-keys.                                                                                                                                                                                                                        |
| `CDP_API_KEY_SECRET`                              | yes                        | Matching CDP secret from the same API key.                                                                                                                                                                                                                                                                                                                                                     |
| `BASE_URL`                                        | no                         | Origin URL used as the 402 realm, OpenAPI server URL, and MPP memo prefix. **On Vercel, leave unset** — `@agentcash/router` auto-derives it from `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`. Set explicitly only if you want to pin a custom domain.                                                                                                                                   |
| `SOLANA_PAYEE_ADDRESS`                            | no                         | When set, the router also accepts Solana payments. `.upTo()` is Base-only and `.session()` is MPP-only; Solana clients can only pay static-priced `.paid()` routes.                                                                                                                                                                                                                            |
| `MPP_OPERATOR_KEY`                                | no                         | Enables MPP _session_ mode (`.session()` routes). Tempo-compatible EVM private key that resolves to the same address as `EVM_PAYEE_ADDRESS`. One-shot MPP on `.paid()` routes works without it. See [Enabling MPP session routes](#enabling-mpp-session-routes).                                                                                                                               |
| `MPP_SECRET_KEY`, `MPP_CURRENCY`, `TEMPO_RPC_URL` | no                         | Override the auto-derived MPP defaults. The template derives `MPP_SECRET_KEY` from `MPP_OPERATOR_KEY` (when set) or `EVM_PAYEE_ADDRESS`, so one-shot MPP is live on first deploy; the payee-derived fallback is publicly computable, so set your own (`openssl rand -hex 32`) for production. `MPP_CURRENCY` defaults to Tempo USDC and `TEMPO_RPC_URL` to the public `https://rpc.tempo.xyz`. |
| `MPP_FEE_PAYER_KEY`                               | no                         | Sponsors client gas for MPP channel open/topUp. Must differ from the operator address. Holding native Tempo gas is your responsibility. Omit to make clients pay their own gas — the right default.                                                                                                                                                                                            |
| `X402_BUILDER_CODE`                               | no                         | Base Builder Code (ERC-8021 attribution). Register at [dashboard.base.org](https://dashboard.base.org) → Settings → Builder Codes; when set, every settled x402 payment is attributed to your app on-chain.                                                                                                                                                                                    |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`            | recommended for production | Vercel KV / Upstash credentials. Auto-injected when you attach a KV store from the Vercel Storage tab after deploy. Without these, in-memory SIWX/MPP state lives per-Lambda-instance and breaks at scale.                                                                                                                                                                                     |

The deploy button only surfaces the three required vars by default. Add the optional MPP/Solana/KV vars in the Vercel dashboard after the first deploy if you want to extend the rails.

## Local development

```bash
cp .env.example .env.local        # fill in EVM_PAYEE_ADDRESS, CDP_API_KEY_ID, CDP_API_KEY_SECRET, BASE_URL=http://localhost:3000
npm install
npm run dev                       # http://localhost:3000
```

The landing page at `/` lists every endpoint with a copy-pasteable `npx agentcash fetch` command. Use the [AgentCash CLI](https://agentcash.dev) (`npx agentcash`) for the smoothest local-testing experience — it handles wallet, payment, and SIWX signing for you.

## What's where

| File                        | Purpose                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/router.ts`             | `createRouterFromEnv` call that reads env at boot. Edit the title, description, and `guidance` string here.        |
| `lib/routes.ts`             | Barrel that imports every route module — required so the discovery handlers see them. Add new routes to this list. |
| `app/api/fortune/*`         | The demo endpoints. Each file leads with a comment explaining which payment mode it exercises.                     |
| `app/openapi.json/route.ts` | AgentCash Discovery — the OpenAPI 3.x spec with pricing extensions.                                                |
| `app/llms.txt/route.ts`     | LLM-readable guidance for agents that don't speak AgentCash Discovery natively.                                    |
| `app/page.tsx`              | The landing page you saw after deploying.                                                                          |
| `next.config.ts`            | Minimal Next config; router env derivation lives in `@agentcash/router`.                                           |

## Enabling MPP session routes

MPP comes in two tiers here, and the first is already on:

- **One-shot MPP (on by default).** `.paid()` routes accept MPP payments on Tempo alongside x402 on Base — `npx agentcash fetch <origin>/api/fortune --method POST -p mpp` works on a fresh deploy. The template auto-derives the required config:

  | Var              | Default                                                                                                                             | When you'd override                                                                                                                                                                                       |
  | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `MPP_CURRENCY`   | Tempo USDC (`0x20c0...8b50`)                                                                                                        | Charging in a non-USDC Tempo currency                                                                                                                                                                     |
  | `TEMPO_RPC_URL`  | `https://rpc.tempo.xyz`                                                                                                             | The public endpoint works out of the box; paste a dedicated endpoint here only if you have one                                                                                                            |
  | `MPP_SECRET_KEY` | SHA-256 of `agentcash-template-mpp:` + operator key when set, else the payee address (stable across deploys, never written to disk) | Production hardness — the payee-derived fallback is publicly computable (payments are still verified on-chain; it only weakens challenge replay hardening). Generate your own with `openssl rand -hex 32` |

- **MPP session mode (needs one env var).** Per-request metered billing and SSE token-by-token streaming (`.session()` routes). These route files are already in the template — they just refuse to register until the operator key is configured. To turn them on:

1. **Pick an MPP operator key.** It must be a Tempo-compatible EVM private key that resolves to the same address as `EVM_PAYEE_ADDRESS`. This key signs MPP session close transactions, so treat it like a hot wallet (small balance, narrow scope).

2. **Add `MPP_OPERATOR_KEY` to your Vercel project's environment variables** and trigger a redeploy. That's the minimum — currency, RPC URL, and secret key cascade from the defaults above.

3. **Optional: sponsor client gas with `MPP_FEE_PAYER_KEY`.** A separate Tempo key (different address from the operator) that pays for MPP channel open/topUp on behalf of clients. Must hold native Tempo gas before any traffic — otherwise paid calls fail with a generic "Payment verification failed" while the actual `insufficient funds` error only surfaces through the router's `onAlert` plugin hook (which this template forwards to the Vercel Functions log). Omit to make clients pay their own gas — the right default for most paid APIs.

4. **Verify.** After the redeploy completes, hit `/openapi.json` and the session routes (`/api/fortune/llm`, `/api/fortune/stream`) should now appear in the spec. Or run `npx agentcash fetch <origin>/api/fortune/llm --method POST -p mpp -b '{"prompt":"test"}'` and confirm settlement.

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
3. Add Upstash Redis / Vercel KV from the Vercel Storage tab before production traffic if you use `.siwx()` replay or MPP replay protection across serverless instances.
4. Update the title, description, and `guidance` in `lib/router.ts` so the discovery doc reflects what you ship. Optionally add `serviceName`, `tags`, and `iconUrl` there too — they're forwarded on every x402 challenge and persisted into the Bazaar discovery catalog at settlement.
5. Push to GitHub. Vercel rebuilds and your `openapi.json` updates automatically.
6. Once you're on a real domain, [register with the explorers](#register-with-the-explorers) so agents can find you.

## How agents discover your API

Once deployed, agents find your endpoints via:

- `https://<your-domain>/openapi.json` — AgentCash Discovery (OpenAPI 3.x + AgentCash extensions). Indexed by [AgentCash](https://agentcash.dev), [x402scan](https://x402scan.com), [MPPScan](https://mppscan.com), and anyone else who crawls the format.
- `https://<your-domain>/llms.txt` — plain-English usage guidance.

No marketplace, no API keys. The spec is the contract.

### Register with the explorers

Registration is optional — the discovery endpoints work without it — but listing your API on the protocol explorers is how most agents (and their humans) will find it. Do this **after** you've attached a real custom domain: listings point at your origin, and you don't want them anchored to a temporary `*.vercel.app` URL.

- **[x402scan](https://www.x402scan.com/resources/register)** — the x402 ecosystem explorer. Submit your origin at https://www.x402scan.com/resources/register.
- **[MPPScan](https://mppscan.com/register)** — the MPP ecosystem explorer. Submit your origin at https://mppscan.com/register.

Each registration flow has its own requirements (e.g. verifying your `/openapi.json` resolves, resource metadata) — follow whatever guidance the form gives you. Both explorers crawl the same discovery doc this template already serves, so no code changes should be needed.

## License

MIT. See the root [LICENSE](../../LICENSE).
