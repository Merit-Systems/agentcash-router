import type { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../pricing/index.js';
import type { RouteEntry } from '../../types.js';
import { errorMessage, errorStatus } from './errors.js';
import { fail } from './fail.js';
import { firePluginResponse } from './fire-plugin-response.js';
import { parseBody } from './parse-body.js';
import { runValidate } from './run-validate.js';
import type { FlowCtx } from './types.js';

export type BodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: NextResponse };

/**
 * Parses the request body, runs `validate()`, and quotes the price.
 *
 * Five exit cases (each handled by an early return below):
 *
 *   1. `skipBody` (channel-management credentials) — bypass body work; return
 *      a surrogate price drawn from the route's cap. Settle won't bill
 *      content for these credentials, so the price is metadata-only.
 *   2. body parse error — return the parser's 400/415 response.
 *   3. validate() error — return the validator's response (typically 400/422).
 *   4. no pricing configured — 500.
 *   5. price-quote throws — surface as the error's status (default 500).
 *
 * Otherwise returns the parsed body + quoted price.
 */
export async function resolveBodyAndPrice(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  skipBody: boolean;
}): Promise<BodyAndPriceResolution> {
  const { ctx, pricing, skipBody } = args;

  // Case 1: skipBody
  if (skipBody) {
    return {
      ok: true,
      parsedBody: undefined,
      price: surrogatePriceForSkippedBody(ctx.routeEntry),
    };
  }

  // Case 2: body parse error
  const body = await parseBody(ctx.request, ctx.routeEntry);
  if (!body.ok) {
    firePluginResponse(ctx, body.response);
    return { ok: false, response: body.response };
  }

  // Case 3: validate() error
  const validateErr = await runValidate(ctx, body.data);
  if (validateErr) {
    return { ok: false, response: validateErr };
  }

  // Case 4: no pricing configured
  if (!pricing) {
    return { ok: false, response: fail(ctx, 500, 'Pricing not configured', body.data) };
  }

  // Case 5: price-quote throws (or happy path)
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
