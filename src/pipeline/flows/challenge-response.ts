import { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../pricing/index.js';
import { attachAgentIdentityChallenge } from '../../auth/agent-identity.js';
import { getAllowedStrategies } from '../../protocols/index.js';
import type { ChallengeContribution, VerifyFailure } from '../../protocols/types.js';
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

  let checkoutSession: Record<string, unknown> | null | undefined;
  if (ctx.routeEntry.checkoutSession) {
    try {
      checkoutSession = await ctx.routeEntry.checkoutSession({
        request: ctx.request,
        route: ctx.routeEntry.key,
        body,
        price: challengePrice,
      });
    } catch (err) {
      const message = errorMessage(err, 'Checkout session build failed');
      const responseBody = { success: false, error: message };
      const errorResponse = NextResponse.json(responseBody, { status: errorStatus(err, 500) });
      firePluginResponse(ctx, errorResponse, body, responseBody, { message, cause: err });
      return errorResponse;
    }
  }

  const contributions: ChallengeContribution[] = [];
  for (const strategy of getAllowedStrategies(ctx.routeEntry.protocols)) {
    try {
      contributions.push(
        await strategy.buildChallenge({
          request: ctx.request,
          routeEntry: ctx.routeEntry,
          body,
          price: challengePrice,
          extensions,
          deps: ctx.deps,
          report: ctx.report,
        }),
      );
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

  const responsePayload: Record<string, unknown> = {
    ...Object.assign({}, ...contributions.map((contribution) => contribution.body ?? {})),
    ...(failure && { error: failure.message ?? null, reason: failure.reason }),
    ...(checkoutSession && { checkout_session: checkoutSession }),
  };
  const responseBody = Object.keys(responsePayload).length ? JSON.stringify(responsePayload) : null;

  const response = new NextResponse(responseBody, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

  for (const contribution of contributions) {
    if (contribution.headers) {
      for (const [name, value] of Object.entries(contribution.headers)) {
        response.headers.set(name, value);
      }
    }
  }

  await attachAgentIdentityChallenge(response, ctx.request, ctx.deps.agentIdentityNonceStore);

  firePluginResponse(ctx, response);
  return response;
}
