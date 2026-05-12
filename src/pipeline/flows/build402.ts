import { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../pricing/index.js';
import { firePluginHook } from '../../plugin.js';
import { getAllowedStrategies } from '../../protocols/index.js';
import type { VerifyFailure } from '../../protocols/types.js';
import { buildChallengeExtensions } from '../challenge-extensions.js';
import { errorMessage, errorStatus, firePluginResponse, type FlowCtx } from '../context/index.js';

export async function build402(
  ctx: FlowCtx,
  pricing: PricingStrategy | null,
  body: unknown | undefined,
  failure?: VerifyFailure,
): Promise<NextResponse> {
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

  const extensions = await buildChallengeExtensions(ctx);

  const responseBody = failure
    ? JSON.stringify({ error: failure.message ?? null, reason: failure.reason })
    : null;

  const response = new NextResponse(responseBody, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

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
