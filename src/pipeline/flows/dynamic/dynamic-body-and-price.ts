import type { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../../pricing/index.js';
import type { RouteEntry } from '../../../types.js';
import {
  errorMessage,
  errorStatus,
  fail,
  parseBody,
  runValidate,
  type FlowCtx,
} from '../../context/index.js';

export type DynamicBodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: NextResponse };

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

  const body = await parseBody(ctx);
  if (!body.ok) return { ok: false, response: body.response };

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
