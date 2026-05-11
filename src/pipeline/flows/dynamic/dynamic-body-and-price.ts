import type { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../../pricing/index.js';
import type { RouteEntry } from '../../../types.js';
import {
  errorMessage,
  errorStatus,
  fail,
  firePluginResponse,
  parseBody,
  runValidate,
  type FlowCtx,
} from '../../context/index.js';

export type DynamicBodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: NextResponse };

/**
 * Dynamic-route body + price resolution. Five exit cases:
 *
 *   1. `skipBody` (channel-management credentials) — bypass body work; return
 *      a surrogate price drawn from the route's cap. Settle won't bill content
 *      for these credentials, so the price is metadata-only.
 *   2. body parse error — return the parser's 400/415 response.
 *   3. validate() error — return the validator's response.
 *   4. no pricing configured — 500.
 *   5. price-quote throws (or happy path) — surface as the error's status.
 */
export async function resolveDynamicBodyAndPrice(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  skipBody: boolean;
}): Promise<DynamicBodyAndPriceResolution> {
  const { ctx, pricing, skipBody } = args;

  if (skipBody) {
    return {
      ok: true,
      parsedBody: undefined,
      price: surrogatePriceForSkippedBody(ctx.routeEntry),
    };
  }

  const body = await parseBody(ctx.request, ctx.routeEntry);
  if (!body.ok) {
    firePluginResponse(ctx, body.response);
    return { ok: false, response: body.response };
  }

  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) {
    return { ok: false, response: validateErr };
  }

  if (!pricing) {
    return { ok: false, response: fail(ctx, 500, 'Pricing not configured', body.data) };
  }

  try {
    const price = await pricing.quote(body.data);
    return { ok: true, parsedBody: body.data, price };
  } catch (err) {
    return {
      ok: false,
      response: fail(
        ctx,
        errorStatus(err, 500),
        errorMessage(err, 'Price calculation failed'),
        body.data,
      ),
    };
  }
}

function surrogatePriceForSkippedBody(routeEntry: RouteEntry): string {
  return routeEntry.maxPrice ?? routeEntry.minPrice ?? '0';
}
