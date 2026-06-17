import type { AlertEvent, ProtocolType, ProviderQuotaEvent } from '../types.js';

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
  protocol: ProtocolType;
  payer: string;
  amount: string;
  network: string;
}

export interface SettlementEvent {
  protocol: ProtocolType;
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
  /** Handler return value or structured router-generated error body. */
  responseBody?: unknown;
  /** Rich error details for non-402 failure responses. */
  error?: ErrorEvent;
}

export interface ErrorEvent {
  status: number;
  message: string;
  settled: boolean;
  requestId?: string;
  route?: string;
  method?: string;
  duration?: number;
  walletAddress?: string | null;
  verifiedWallet?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  errorName?: string;
  stack?: string;
  cause?: unknown;
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
        console.error(`[router] ERROR ${method}: ${formatUnknownError(error)}`);
      });
    }
    return result;
  } catch (error) {
    console.error(`[router] ERROR ${method}: ${formatUnknownError(error)}`);
    return undefined;
  }
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
