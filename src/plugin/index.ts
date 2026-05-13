import type { AlertEvent, ProviderQuotaEvent } from '../types.js';

export interface RequestMeta {
  requestId: string;
  method: string;
  route: string;
  origin: string;
  referer: string | null;
  walletAddress: string | null;
  clientId: string | null;
  sessionId: string | null;
  contentType: string | null;
  headers: Record<string, string>;
  startTime: number;
}

export interface PluginContext {
  readonly requestId: string;
  readonly route: string;
  readonly walletAddress: string | null;
  readonly clientId: string | null;
  readonly sessionId: string | null;
  verifiedWallet: string | null;
  setVerifiedWallet(address: string): void;
}

export interface PaymentEvent {
  protocol: 'x402' | 'mpp';
  payer: string;
  amount: string;
  network: string;
}

export interface SettlementEvent {
  protocol: 'x402' | 'mpp';
  payer: string;
  transaction: string;
  network: string;
}

export interface ResponseMeta {
  statusCode: number;
  statusText: string;
  duration: number;
  contentType: string | null;
  headers: Record<string, string>;
  /** Parsed request body (when .body() was used). undefined when no body was parsed. */
  requestBody?: unknown;
  /** Handler return value. undefined for raw Response returns (streams) or error paths. */
  responseBody?: unknown;
}

export interface ErrorEvent {
  status: number;
  message: string;
  settled: boolean;
}

export interface AuthEvent {
  /** Authentication mode that was verified */
  authMode: 'siwx' | 'apiKey';
  /** Verified canonical wallet address (EVM lowercase, non-EVM preserved) */
  wallet: string | null;
  /** Route key */
  route: string;
  /** Account data from API key resolver (for apiKey auth) */
  account?: unknown;
}

export interface RouterPlugin {
  init?(config: { origin?: string }): void | Promise<void>;
  onRequest?(meta: RequestMeta): PluginContext;
  /** Fired after successful SIWX or API key verification, before handler */
  onAuthVerified?(ctx: PluginContext, event: AuthEvent): void;
  onPaymentVerified?(ctx: PluginContext, payment: PaymentEvent): void;
  onPaymentSettled?(ctx: PluginContext, settlement: SettlementEvent): void;
  onResponse?(ctx: PluginContext, response: ResponseMeta): void;
  onError?(ctx: PluginContext, error: ErrorEvent): void;
  onAlert?(ctx: PluginContext, alert: AlertEvent): void;
  onProviderQuota?(ctx: PluginContext, event: ProviderQuotaEvent): void;
}

export function createDefaultContext(meta: RequestMeta): PluginContext {
  const ctx: PluginContext = {
    requestId: meta.requestId,
    route: meta.route,
    walletAddress: meta.walletAddress,
    clientId: meta.clientId,
    sessionId: meta.sessionId,
    verifiedWallet: null,
    setVerifiedWallet(address: string) {
      ctx.verifiedWallet = address;
    },
  };
  return ctx;
}

export function firePluginHook(
  plugin: RouterPlugin | undefined,
  method: keyof RouterPlugin,
  ...args: unknown[]
): unknown {
  if (!plugin) return undefined;
  const fn = plugin[method];
  if (typeof fn !== 'function') return undefined;
  try {
    const result = (fn as (...a: unknown[]) => unknown).apply(plugin, args);
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch((error) => {
        console.error(
          `[router] ERROR ${method}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }
    return result;
  } catch (error) {
    console.error(
      `[router] ERROR ${method}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

export function consolePlugin(): RouterPlugin {
  return {
    onRequest(meta) {
      const ctx = createDefaultContext(meta);
      return ctx;
    },

    onAuthVerified(_ctx, auth) {
      const wallet = auth.wallet ? ` wallet=${auth.wallet}` : '';
      console.log(`[router] AUTH ${auth.authMode} ${auth.route}${wallet}`);
    },

    onPaymentVerified(_ctx, payment) {
      console.log(`[router] VERIFIED ${payment.protocol} ${payment.payer} ${payment.amount}`);
    },

    onPaymentSettled(_ctx, settlement) {
      console.log(`[router] SETTLED ${settlement.protocol} tx=${settlement.transaction}`);
    },

    onResponse(ctx, response) {
      const wallet = ctx.verifiedWallet ? ` wallet=${ctx.verifiedWallet}` : '';
      console.log(
        `[router] ${ctx.route} → ${response.statusCode} (${response.duration}ms)${wallet}`,
      );
    },

    onError(_ctx, error) {
      console.error(`[router] ERROR ${error.status}: ${error.message}`);
    },

    onAlert(_ctx, alert) {
      const logFn =
        alert.level === 'critical' || alert.level === 'error'
          ? console.error
          : alert.level === 'warn'
            ? console.warn
            : console.log;
      logFn(
        `[router] ${alert.level.toUpperCase()} ${alert.route}: ${alert.message}`,
        alert.meta ?? '',
      );
    },

    onProviderQuota(_ctx, event) {
      const logFn =
        event.level === 'critical'
          ? console.error
          : event.level === 'warn'
            ? console.warn
            : console.log;
      logFn(`[router] QUOTA ${event.level.toUpperCase()} ${event.provider}: ${event.message}`);
    },
  };
}
