import { createHash } from 'node:crypto';
import { createRouterFromEnv, type RouterPlugin } from '@agentcash/router';

// Auto-derive MPP defaults when the user opts in by setting MPP_OPERATOR_KEY.
// The operator key is the only MPP env var the user has to provide — everything
// else cascades to sensible defaults so a fresh deploy can flip MPP on by
// adding a single env var in the Vercel dashboard.
if (process.env.MPP_OPERATOR_KEY) {
  // Tempo USDC. Matches @agentcash/router's exported TEMPO_USDC_ADDRESS constant.
  process.env.MPP_CURRENCY ??= '0x20c000000000000000000000b9537d11c60e8b50';

  // Public Tempo RPC. The router's schema validator notes this can return 401
  // depending on Tempo's current policy; if MPP traffic fails with that, paste
  // an authenticated URL into the Vercel env vars and redeploy.
  process.env.TEMPO_RPC_URL ??= 'https://rpc.tempo.xyz';

  // HMAC secret for MPP voucher replay protection. Derived deterministically
  // from the operator key so it's stable across deploys without storage. For
  // production hardness, generate your own with `openssl rand -hex 32` and set
  // MPP_SECRET_KEY explicitly in the Vercel dashboard.
  process.env.MPP_SECRET_KEY ??= createHash('sha256')
    .update(`agentcash-template-mpp:${process.env.MPP_OPERATOR_KEY}`)
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
    console.error(
      `[router] ${error.status} ${error.message} (settled=${error.settled})`,
    );
  },
};

export const router = createRouterFromEnv({
  title: 'Fortune Demo',
  description:
    'Pay-per-call fortune-telling API on x402 and MPP. Powered by @agentcash/router.',
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

// Whether MPP routes should register. The `.metered()` pricing mode requires
// MPP session mode, which the router auto-enables when MPP_OPERATOR_KEY is set
// (see `createRouterFromEnv` behavior). Without it, `.metered()` throws at
// route registration — so we gate the MPP route files on this flag and serve
// a 503 from the route handler when MPP isn't configured.
export const mppEnabled = !!process.env.MPP_OPERATOR_KEY;
