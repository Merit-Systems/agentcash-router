import { firePluginHook, type PluginContext, type RouterPlugin } from './plugin.js';
import type { AlertLevel } from './types.js';

export type ReportFn = (level: AlertLevel, message: string, meta?: Record<string, unknown>) => void;

export function createReporter(
  plugin: RouterPlugin | undefined,
  pluginCtx: PluginContext,
  route: string,
): ReportFn {
  return (level, message, meta) => {
    firePluginHook(plugin, 'onAlert', pluginCtx, {
      level,
      message,
      route,
      ...(meta ? { meta } : {}),
    });
  };
}
