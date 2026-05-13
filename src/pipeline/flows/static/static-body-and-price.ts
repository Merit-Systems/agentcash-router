import type { NextResponse } from 'next/server';
import type { PricingStrategy } from '../../../pricing/index.js';
import {
  errorMessage,
  errorStatus,
  fail,
  parseBody,
  runValidate,
  type FlowCtx,
} from '../../steps/index.js';

export type StaticBodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: NextResponse };

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
