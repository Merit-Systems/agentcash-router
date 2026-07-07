import { HEADERS } from '../headers.js';
import type { FlowCtx } from '../pipeline/steps/types.js';
import type { ProviderQuotaEvent, QuotaLevel } from '../types.js';
import {
  type AuthEvent,
  type ErrorEvent,
  firePluginHook,
  type PaymentEvent,
  type SettlementEvent,
} from './index.js';

export type PluginFailure = {
  message?: string;
  cause?: unknown;
  settled?: boolean;
};

export function fireAuthVerified(ctx: FlowCtx, event: Omit<AuthEvent, 'route'>): void {
  firePluginHook(ctx.deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    ...event,
    route: ctx.routeEntry.key,
  });
}

export function firePaymentVerified(ctx: FlowCtx, event: PaymentEvent): void {
  firePluginHook(ctx.deps.plugin, 'onPaymentVerified', ctx.pluginCtx, event);
}

export function firePaymentSettled(ctx: FlowCtx, event: SettlementEvent): void {
  firePluginHook(ctx.deps.plugin, 'onPaymentSettled', ctx.pluginCtx, event);
}

export function firePluginResponse(
  ctx: FlowCtx,
  response: Response,
  requestBody?: unknown,
  responseBody?: unknown,
  failure?: PluginFailure,
): void {
  attachRequestId(response, ctx.meta.requestId);
  const error =
    response.status >= 400 && response.status !== 402
      ? buildErrorEvent(ctx, response, failure)
      : undefined;

  firePluginHook(ctx.deps.plugin, 'onResponse', ctx.pluginCtx, {
    statusCode: response.status,
    statusText: response.statusText,
    duration: Date.now() - ctx.meta.startTime,
    contentType: response.headers.get('content-type'),
    headers: Object.fromEntries(response.headers.entries()),
    requestBody,
    responseBody,
    error,
  });

  if (error) {
    if (response.status >= 500) logRouterFailure(error);
    firePluginHook(ctx.deps.plugin, 'onError', ctx.pluginCtx, error);
  }
}

export function fireProviderQuota(ctx: FlowCtx, response: Response, handlerResult: unknown): void {
  const { providerName, providerConfig } = ctx.routeEntry;
  if (!providerName || !providerConfig?.extractQuota) return;
  if (response.status >= 400) return;

  try {
    const quota = providerConfig.extractQuota(handlerResult, response.headers);
    if (!quota) return;

    const level = computeQuotaLevel(quota.remaining, providerConfig.warn, providerConfig.critical);
    const overage = providerConfig.overage ?? 'same-rate';

    const event: ProviderQuotaEvent = {
      provider: providerName,
      route: ctx.routeEntry.key,
      remaining: quota.remaining,
      limit: quota.limit,
      spend: quota.spend,
      level,
      overage,
      message:
        quota.remaining !== null
          ? `${providerName}: ${quota.remaining}${quota.limit ? `/${quota.limit}` : ''} remaining`
          : `${providerName}: quota info unavailable`,
    };

    firePluginHook(ctx.deps.plugin, 'onProviderQuota', ctx.pluginCtx, event);
  } catch {
    /* fire-and-forget */
  }
}

function computeQuotaLevel(remaining: number | null, warn?: number, critical?: number): QuotaLevel {
  if (remaining === null) return 'healthy';
  if (critical !== undefined && remaining <= critical) return 'critical';
  if (warn !== undefined && remaining <= warn) return 'warn';
  return 'healthy';
}

function attachRequestId(response: Response, requestId: string): void {
  try {
    if (!response.headers.has(HEADERS.REQUEST_ID)) {
      response.headers.set(HEADERS.REQUEST_ID, requestId);
    }
  } catch {
    // Some custom Response objects may have immutable headers.
  }
}

function buildErrorEvent(ctx: FlowCtx, response: Response, failure?: PluginFailure): ErrorEvent {
  const error = errorDetails(failure?.cause);
  const responseMessage = response.statusText || `HTTP ${response.status}`;
  const message = failure?.message ?? error.message ?? responseMessage;

  return {
    status: response.status,
    message,
    settled: failure?.settled ?? false,
    requestId: ctx.meta.requestId,
    route: ctx.meta.route,
    method: ctx.meta.method,
    duration: Date.now() - ctx.meta.startTime,
    walletAddress: ctx.meta.walletAddress,
    verifiedWallet: ctx.pluginCtx.verifiedWallet,
    clientId: ctx.meta.clientId,
    sessionId: ctx.meta.sessionId,
    errorName: error.name,
    stack: error.stack,
    cause: failure?.cause,
  };
}

function errorDetails(error: unknown): { message?: string; name?: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      stack: typeof record.stack === 'string' ? record.stack : undefined,
    };
  }

  if (typeof error === 'string') return { message: error };
  return {};
}

function logRouterFailure(error: ErrorEvent): void {
  console.error(`[router] ERROR ${error.route ?? 'unknown'} ${error.status}: ${error.message}`, {
    requestId: error.requestId,
    method: error.method,
    duration: error.duration,
    walletAddress: error.walletAddress,
    verifiedWallet: error.verifiedWallet,
    clientId: error.clientId,
    sessionId: error.sessionId,
    errorName: error.errorName,
    stack: error.stack,
  });
}
