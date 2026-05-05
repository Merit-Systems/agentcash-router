import { NextResponse } from 'next/server';
import type { PricingStrategy } from '../pricing/index.js';
import { firePluginHook } from '../plugin.js';
import { buildSIWXExtension } from '../auth/siwx.js';
import { getAllowedStrategies } from '../protocols/index.js';
import type { FlowCtx } from './context/index.js';
import { errorMessage, errorStatus, firePluginResponse } from './context/index.js';

/**
 * Build a 402 challenge response composing contributions from every allowed
 * payment protocol strategy. The orchestrator never knows which protocol is
 * speaking — strategies set their own headers via ChallengeContribution.
 *
 * Returns:
 *   - 402 with PAYMENT-REQUIRED + WWW-Authenticate (per allowed protocols)
 *   - 500 if x402 challenge construction fails (without it, clients can't pay)
 *   - error response if dynamic pricing fails with no maxPrice fallback
 */
export async function build402(
  ctx: FlowCtx,
  pricing: PricingStrategy | null,
  body: unknown | undefined,
): Promise<NextResponse> {
  // 1. Resolve advertised price
  let challengePrice: string;
  try {
    challengePrice = pricing ? await pricing.challengeQuote(body) : '0';
  } catch (err) {
    const message = errorMessage(err, 'Price calculation failed');
    const errorResponse = NextResponse.json(
      { success: false, error: message },
      { status: errorStatus(err, 500) },
    );
    firePluginResponse(ctx, errorResponse);
    return errorResponse;
  }

  // 2. Compose extensions (bazaar input/output schemas + optional SIWX)
  const extensions = await buildChallengeExtensions(ctx);

  // 3. Skeleton response. Strategies layer headers on top.
  const response = new NextResponse(null, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

  // 4. Each allowed strategy contributes headers/body.
  for (const strategy of getAllowedStrategies(ctx.routeEntry.protocols)) {
    try {
      const contribution = await strategy.buildChallenge({
        request: ctx.request,
        routeEntry: ctx.routeEntry,
        body,
        price: challengePrice,
        extensions,
        deps: ctx.deps,
      });
      if (contribution.headers) {
        for (const [name, value] of Object.entries(contribution.headers)) {
          response.headers.set(name, value);
        }
      }
    } catch (err) {
      const message = `${strategy.protocol} challenge build failed: ${errorMessage(err, String(err))}`;
      firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
        level: 'critical' as const,
        message,
        route: ctx.routeEntry.key,
      });
      // x402 challenge failure is fatal — without PAYMENT-REQUIRED, clients can't pay.
      // MPP challenge failure is logged but non-fatal — x402 still works.
      if (strategy.protocol === 'x402') {
        const errorResponse = NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
        firePluginResponse(ctx, errorResponse);
        return errorResponse;
      }
    }
  }

  firePluginResponse(ctx, response);
  return response;
}

/**
 * Build the bazaar discovery extension (input/output JSON Schemas) plus an
 * optional SIWX extension for paid+SIWX routes. The SIWX-only challenge has
 * a different shape and is built in flows/siwx-only.ts.
 */
async function buildChallengeExtensions(
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
