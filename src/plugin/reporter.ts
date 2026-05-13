import type { AlertLevel } from '../types.js';
import { firePluginHook, type PluginContext, type RouterPlugin } from './index.js';

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
