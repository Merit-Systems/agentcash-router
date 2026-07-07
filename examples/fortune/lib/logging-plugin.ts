import type { RouterPlugin } from '@agentcash/router';

// Verbose console plugin — logs every router lifecycle event with the
// requestId so concurrent requests interleave legibly. Alerts are where the
// protocol layers narrate (challenge builds, MPP session events, settlement
// retries), so `onAlert` is the most useful hook when debugging payments.

const started = new Map<string, number>();

function tag(requestId: string, route: string) {
  return `[fortune ${requestId.slice(0, 8)} ${route}]`;
}

function compact(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text && text.length > 400 ? `${text.slice(0, 400)}…` : (text ?? String(value));
  } catch {
    return String(value);
  }
}

export const loggingPlugin: RouterPlugin = {
  init({ origin }) {
    console.log(`[fortune] router initialized for ${origin}`);
  },

  onRequest(meta) {
    started.set(meta.requestId, meta.startTime);
    console.log(
      `${tag(meta.requestId, meta.route)} → ${meta.method}`,
      compact({
        contentType: meta.contentType,
        wallet: meta.walletAddress,
        client: meta.clientId,
        session: meta.sessionId,
      }),
    );
    return {
      requestId: meta.requestId,
      route: meta.route,
      walletAddress: meta.walletAddress,
      clientId: meta.clientId,
      sessionId: meta.sessionId,
      verifiedWallet: null,
      setVerifiedWallet(address: string) {
        this.verifiedWallet = address;
      },
    };
  },

  onAuthVerified(ctx, event) {
    console.log(`${tag(ctx.requestId, ctx.route)} auth verified (${event.authMode})`, event.wallet);
  },

  onPaymentVerified(ctx, payment) {
    console.log(
      `${tag(ctx.requestId, ctx.route)} payment verified: ${payment.amount} via ${payment.protocol} (${payment.network}) from ${payment.payer}`,
    );
  },

  onPaymentSettled(ctx, settlement) {
    console.log(
      `${tag(ctx.requestId, ctx.route)} payment settled: ${settlement.transaction || '(deferred — session channel)'} on ${settlement.network}`,
    );
  },

  onResponse(ctx, response) {
    started.delete(ctx.requestId);
    console.log(
      `${tag(ctx.requestId, ctx.route)} ← ${response.statusCode} in ${response.duration}ms`,
      response.error ? compact(response.error) : '',
    );
  },

  onError(ctx, error) {
    console.error(
      `${tag(ctx.requestId, ctx.route)} ✖ ${error.status} ${error.message}`,
      error.stack ?? '',
    );
  },

  onAlert(ctx, alert) {
    const level = alert.level === 'error' || alert.level === 'critical' ? 'error' : 'log';
    console[level](
      `${tag(ctx.requestId, ctx.route)} [${alert.level}] ${alert.message}`,
      alert.meta ? compact(alert.meta) : '',
    );
  },
};
