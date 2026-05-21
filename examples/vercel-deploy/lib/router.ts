import { createRouterFromEnv, type RouterPlugin } from '@agentcash/router';

// Forward router warnings + payment errors to Vercel logs so misconfiguration
// (missing CDP creds, MPP fee-payer balance, etc.) is visible in the Vercel
// Functions tab instead of surfacing as opaque 500s. Silenced in development.
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
  title: 'Fortune API',
  description: 'Pay-per-call fortune-telling API. Powered by @agentcash/router.',
  guidance:
    'POST /api/fortune for a single fortune ($0.001, x402 exact or MPP one-shot). ' +
    'POST /api/fortune/premium for x402 upto (handler calls charge(amount)). ' +
    'POST /api/fortune/dynamic for body-derived pricing. ' +
    'POST /api/fortune/membership for pay-once-then-SIWX-replay. ' +
    'GET /api/fortune/profile and GET/POST /api/fortune/favorites are SIWX (identity, no payment).',
  plugin: loggingPlugin,
});
