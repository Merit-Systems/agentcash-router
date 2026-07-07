import { buildSIWXExtension } from '../auth/siwx.js';
import { isEvmNetwork } from '../protocols/x402/evm.js';
import type { FlowCtx } from './steps/index.js';

export async function buildChallengeExtensions(
  ctx: FlowCtx,
): Promise<Record<string, unknown> | undefined> {
  const { routeEntry } = ctx;
  let extensions: Record<string, unknown> | undefined;

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
    const isBodyMethod =
      routeEntry.method === 'POST' || routeEntry.method === 'PUT' || routeEntry.method === 'PATCH';
    const config: Record<string, unknown> = { method: routeEntry.method };
    if (isBodyMethod) config.bodyType = 'json';
    if (inputSchema) config.inputSchema = inputSchema;
    if (routeEntry.inputExample !== undefined) {
      config.input = routeEntry.inputExample;
    }
    if (outputSchema && routeEntry.outputExample !== undefined) {
      config.output = { schema: outputSchema, example: routeEntry.outputExample };
    }
    extensions = declareDiscoveryExtension(config);
  } catch (err) {
    ctx.report(
      'warn',
      `Bazaar schema generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
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
      /* optional enrichment */
    }
  }
  if (ctx.deps.builderCode) {
    try {
      const { BUILDER_CODE, declareBuilderCodeExtension } =
        await import('@x402/extensions/builder-code');
      extensions = {
        ...(extensions ?? {}),
        [BUILDER_CODE]: declareBuilderCodeExtension(ctx.deps.builderCode),
      };
    } catch (err) {
      ctx.report(
        'warn',
        `builder-code declaration failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const hasEvmUpto =
    ctx.routeEntry.billing === 'upto' &&
    ctx.deps.x402Accepts.some((accept) => accept.scheme === 'upto' && isEvmNetwork(accept.network));
  if (hasEvmUpto) {
    try {
      const { declareEip2612GasSponsoringExtension } = await import('@x402/extensions');
      extensions = {
        ...(extensions ?? {}),
        ...declareEip2612GasSponsoringExtension(),
      };
    } catch (err) {
      ctx.report(
        'warn',
        `EIP-2612 gas-sponsoring declaration failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return extensions;
}
