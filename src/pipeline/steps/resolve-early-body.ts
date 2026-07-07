import type { PricingStrategy } from '../../pricing/index.js';
import type { PaymentStrategy } from '../../protocols/types.js';
import { parseBody } from './parse-body.js';
import { runValidate } from './run-validate.js';
import { shouldParseBodyEarly } from './should-parse-body-early.js';
import type { FlowCtx } from './types.js';

export type EarlyBodyResolution =
  | { ok: true; earlyBody: unknown }
  | { ok: false; response: Response };

export async function resolveEarlyBody(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  incomingStrategy: PaymentStrategy | null;
}): Promise<EarlyBodyResolution> {
  const { ctx, pricing, incomingStrategy } = args;

  if (!shouldParseBodyEarly(incomingStrategy, ctx.routeEntry, pricing)) {
    return { ok: true, earlyBody: undefined };
  }

  const earlyClone = ctx.request.clone() as Request;
  const earlyResult = await parseBody(ctx, earlyClone);
  // Soft-fail: let the 402 challenge use maxPrice / highest tier as fallback.
  if (!earlyResult.ok) return { ok: true, earlyBody: undefined };

  const validateErr = await runValidate(ctx, earlyResult.data);
  if (validateErr) return { ok: false, response: validateErr };

  return { ok: true, earlyBody: earlyResult.data };
}
