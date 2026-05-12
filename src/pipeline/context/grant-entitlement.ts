import { firePluginHook } from '../../plugin.js';
import type { FlowCtx } from './types.js';

export async function grantEntitlementIfSiwx(ctx: FlowCtx, wallet: string): Promise<void> {
  if (!ctx.routeEntry.siwxEnabled) return;
  try {
    await ctx.deps.entitlementStore.grant(ctx.routeEntry.key, wallet);
  } catch (error) {
    firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'warn' as const,
      message: `Entitlement grant failed: ${error instanceof Error ? error.message : String(error)}`,
      route: ctx.routeEntry.key,
    });
  }
}
