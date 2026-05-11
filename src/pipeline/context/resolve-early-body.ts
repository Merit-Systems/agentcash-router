import type { NextRequest, NextResponse } from 'next/server';
import type { PricingStrategy } from '../../pricing/index.js';
import type { PaymentStrategy } from '../../protocols/types.js';
import { parseBody } from './parse-body.js';
import { runValidate } from './run-validate.js';
import { shouldParseBodyEarly } from './should-parse-body-early.js';
import type { FlowCtx } from './types.js';

export type EarlyBodyResolution =
  | { ok: true; earlyBody: unknown }
  | { ok: false; response: NextResponse };

/**
 * Pre-challenge body parse + validate. Used so that 402 responses can quote
 * accurate prices from body-driven pricers and `validate()` can reject bad
 * input before charging.
 *
 * `shouldParseBodyEarly` only fires when no credential is present (i.e., we're
 * on the path to a 402); strategies and preflight don't apply here, so this
 * helper doesn't take a skip flag. Four exit cases (each handled by an early
 * return):
 *
 *   1. early parse not needed (payment header present, no body schema, or the
 *      pricer doesn't need the body) — no parse, `earlyBody: undefined`.
 *   2. body parse error — return the parser's response.
 *   3. validate() error — return the validator's response.
 *   4. happy — return the parsed body.
 */
export async function resolveEarlyBody(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  incomingStrategy: PaymentStrategy | null;
}): Promise<EarlyBodyResolution> {
  const { ctx, pricing, incomingStrategy } = args;

  // Case 1: early parse not needed
  if (!shouldParseBodyEarly(incomingStrategy, ctx.routeEntry, pricing)) {
    return { ok: true, earlyBody: undefined };
  }

  // Case 2: body parse error
  const earlyClone = ctx.request.clone() as NextRequest;
  const earlyResult = await parseBody(ctx, earlyClone);
  if (!earlyResult.ok) return { ok: false, response: earlyResult.response };

  // Case 3: validate() error
  const validateErr = await runValidate(ctx, earlyResult.data);
  if (validateErr) return { ok: false, response: validateErr };

  // Case 4: happy
  return { ok: true, earlyBody: earlyResult.data };
}
