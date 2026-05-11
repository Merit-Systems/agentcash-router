import type { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../../pricing/index.js';
import {
  errorMessage,
  errorStatus,
  fail,
  parseBody,
  runValidate,
  type FlowCtx,
} from '../../context/index.js';

export type StaticBodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: NextResponse };

/**
 * Static-route body + price resolution. Four exit cases:
 *
 *   1. body parse error — return the parser's 400/415 response.
 *   2. validate() error — return the validator's response.
 *   3. no pricing configured — 500.
 *   4. price-quote throws (or happy path) — surface as the error's status.
 *
 * No `skipBody` branch — channel-management credentials are dynamic-only, so
 * static routes always parse the body and quote a real price.
 */
export async function resolveStaticBodyAndPrice(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
}): Promise<StaticBodyAndPriceResolution> {
  const { ctx, pricing } = args;

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
