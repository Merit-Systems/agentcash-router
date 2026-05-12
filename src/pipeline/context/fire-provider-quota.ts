import type { NextResponse } from 'next/server';
import { firePluginHook } from '../../plugin.js';
import type { ProviderQuotaEvent, QuotaLevel } from '../../types.js';
import type { FlowCtx } from './types.js';

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
