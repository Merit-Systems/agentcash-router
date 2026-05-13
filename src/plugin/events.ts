import type { NextResponse } from 'next/server';
import type { FlowCtx } from '../pipeline/steps/types.js';
import type { ProviderQuotaEvent, QuotaLevel } from '../types.js';
import {
  type AuthEvent,
  firePluginHook,
  type PaymentEvent,
  type SettlementEvent,
} from './index.js';

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
  response: NextResponse,
  requestBody?: unknown,
  responseBody?: unknown,
): void {
  firePluginHook(ctx.deps.plugin, 'onResponse', ctx.pluginCtx, {
    statusCode: response.status,
    statusText: response.statusText,
    duration: Date.now() - ctx.meta.startTime,
    contentType: response.headers.get('content-type'),
    headers: Object.fromEntries(response.headers.entries()),
    requestBody,
    responseBody,
  });

  if (response.status >= 400 && response.status !== 402) {
    firePluginHook(ctx.deps.plugin, 'onError', ctx.pluginCtx, {
      status: response.status,
      message: response.statusText || `HTTP ${response.status}`,
      settled: false,
    });
  }
}

export function fireProviderQuota(
  ctx: FlowCtx,
  response: NextResponse,
  handlerResult: unknown,
): void {
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
