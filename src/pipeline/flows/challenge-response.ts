import { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../pricing/index.js';
import { getAllowedStrategies } from '../../protocols/index.js';
import type { VerifyFailure } from '../../protocols/types.js';
import { buildChallengeExtensions } from '../challenge-extensions.js';
import { errorMessage, errorStatus, firePluginResponse, type FlowCtx } from '../steps/index.js';

export async function buildChallengeResponse(
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
    const responseBody = { success: false, error: message };
    const errorResponse = NextResponse.json(responseBody, { status: errorStatus(err, 500) });
    firePluginResponse(ctx, errorResponse, body, responseBody, { message, cause: err });
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
        report: ctx.report,
      });
      if (contribution.headers) {
        for (const [name, value] of Object.entries(contribution.headers)) {
          response.headers.set(name, value);
        }
      }
    } catch (err) {
      const message = `${strategy.protocol} challenge build failed: ${errorMessage(err, String(err))}`;
      ctx.report('critical', message);
      if (strategy.protocol === 'x402') {
        const responseBody = { success: false, error: message };
        const errorResponse = NextResponse.json(responseBody, { status: 500 });
        firePluginResponse(ctx, errorResponse, body, responseBody, { message, cause: err });
        return errorResponse;
      }
    }
  }

  firePluginResponse(ctx, response);
  return response;
}
