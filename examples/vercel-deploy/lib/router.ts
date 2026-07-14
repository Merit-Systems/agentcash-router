import { createHash } from 'node:crypto';
import { createRouterFromEnv, type RouterPlugin } from '@agentcash/router';

// Auto-derive MPP defaults so one-shot MPP works on a fresh deploy with zero
// extra env vars: `.paid()` routes accept `-p mpp` (Tempo) alongside `-p x402`
// (Base) out of the box. Session routes (`.session()` request/streaming)
// additionally need MPP_OPERATOR_KEY — see `mppSessionEnabled` below.
if (process.env.MPP_OPERATOR_KEY || process.env.EVM_PAYEE_ADDRESS) {
  // Tempo USDC. Matches @agentcash/router's exported TEMPO_USDC_ADDRESS constant.
  process.env.MPP_CURRENCY ??= '0x20c000000000000000000000b9537d11c60e8b50';

  // TEMPO_RPC_URL is left unset on purpose — @agentcash/router defaults it to the
  // public DEFAULT_TEMPO_RPC_URL (https://rpc.tempo.xyz). Set it in the Vercel env
  // vars only if you have a dedicated Tempo endpoint.

  // HMAC secret for MPP challenge-nonce signing. Derived deterministically from
  // the operator key (secret) when set, else the payee address (public) — stable
  // across deploys without storage. A payee-derived secret is computable by
  // anyone; payments are still verified on-chain, so this only weakens challenge
  // forgery/replay hardening. Fine for a demo — for production, generate your
  // own with `openssl rand -hex 32` and set MPP_SECRET_KEY explicitly in the
  // Vercel dashboard.
  process.env.MPP_SECRET_KEY ??= createHash('sha256')
    .update(
      `agentcash-template-mpp:${(process.env.MPP_OPERATOR_KEY ?? process.env.EVM_PAYEE_ADDRESS)!.toLowerCase()}`,
    )
    .digest('hex');
}

// Forward router warnings + payment errors to Vercel logs so misconfiguration
// (missing CDP creds, MPP fee-payer balance, etc.) is visible in the Functions
// tab instead of surfacing as opaque 500s. Silenced in development.
const loggingPlugin: RouterPlugin = {
  onAlert(_ctx, alert) {
    if (process.env.NODE_ENV === 'development') return;
    (alert.level === 'error' ? console.error : console.warn)(
      `[router:${alert.route}] ${alert.message}`,
      alert.meta ?? '',
    );
  },
  onError(_ctx, error) {
    if (process.env.NODE_ENV === 'development') return;
    console.error(`[router] ${error.status} ${error.message} (settled=${error.settled})`);
  },
};

export const router = createRouterFromEnv({
  title: 'Fortune Demo',
  description: 'Pay-per-call fortune-telling API on x402 and MPP. Powered by @agentcash/router.',
  guidance:
    'POST /api/fortune for a single fortune ($0.001, x402 exact or MPP one-shot). ' +
    'POST /api/fortune/premium for x402 upto (handler calls charge(amount)). ' +
    'POST /api/fortune/llm for MPP request-mode metered billing. ' +
    'POST /api/fortune/stream for MPP-streamed token-by-token billing. ' +
    'POST /api/fortune/dynamic for body-derived pricing. ' +
    'POST /api/fortune/membership for pay-once-then-SIWX-replay. ' +
    'GET /api/fortune/profile and GET/POST /api/fortune/favorites are SIWX (identity, no payment).',
  plugin: loggingPlugin,
});

// Whether MPP *session* routes should register. One-shot MPP is always on
// (secret key derived above), but the `.session()` pricing mode requires MPP
// session mode, which the router auto-enables when MPP_OPERATOR_KEY is set
// (see `createRouterFromEnv` behavior). Without it, `.session()` throws at
// route registration — so we gate the session route files on this flag and
// serve a 503 from the route handler until the operator key is configured.
export const mppSessionEnabled = !!process.env.MPP_OPERATOR_KEY;
