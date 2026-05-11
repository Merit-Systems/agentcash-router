import { buildSIWXExtension } from '../auth/siwx.js';
import { firePluginHook } from '../plugin.js';
import type { FlowCtx } from './context/index.js';

/**
 * Build the bazaar discovery extension (input/output JSON Schemas) plus an
 * optional SIWX extension for paid+SIWX routes. The SIWX-only challenge has
 * a different shape and is built in flows/siwx-only.ts.
 */
export async function buildChallengeExtensions(
  ctx: FlowCtx,
): Promise<Record<string, unknown> | undefined> {
  const { routeEntry } = ctx;
  let extensions: Record<string, unknown> | undefined;

  // Bazaar: embed input/output JSON Schema in the 402 challenge so discovery
  // tools can tell callers what fields to send. `unrepresentable: 'any'`
  // handles .transform()/.refine() schemas gracefully.
  //
  // `output` is only emitted when an `outputExample` is registered — bazaar
  // gates the whole output block on example presence.
  try {
    const { z } = await import('zod');
    const { declareDiscoveryExtension } = await import('@x402/extensions/bazaar');
    const toJSON = (schema: unknown) =>
      z.toJSONSchema(schema as Parameters<typeof z.toJSONSchema>[0], {
        target: 'draft-2020-12',
        unrepresentable: 'any',
      });
    const inputSchema = routeEntry.bodySchema
      ? toJSON(routeEntry.bodySchema)
      : routeEntry.querySchema
        ? toJSON(routeEntry.querySchema)
        : undefined;
    const outputSchema = routeEntry.outputSchema ? toJSON(routeEntry.outputSchema) : undefined;
    if (inputSchema) {
      const config: Record<string, unknown> = {
        method: routeEntry.method,
        bodyType: routeEntry.bodySchema ? 'json' : undefined,
        inputSchema,
      };
      if (routeEntry.inputExample !== undefined) {
        config.input = routeEntry.inputExample;
      }
      if (outputSchema && routeEntry.outputExample !== undefined) {
        config.output = { schema: outputSchema, example: routeEntry.outputExample };
      }
      extensions = declareDiscoveryExtension(config);
    }
  } catch (err) {
    firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'warn' as const,
      message: `Bazaar schema generation failed: ${err instanceof Error ? err.message : String(err)}`,
      route: routeEntry.key,
    });
  }

  if (routeEntry.siwxEnabled) {
    try {
      const siwxExtension = await buildSIWXExtension();
      if (siwxExtension && typeof siwxExtension === 'object' && !Array.isArray(siwxExtension)) {
        extensions = {
          ...(extensions ?? {}),
          ...(siwxExtension as Record<string, unknown>),
        };
      }
    } catch {
      // SIWX extension is optional enrichment for 402 challenges
    }
  }

  return extensions;
}
