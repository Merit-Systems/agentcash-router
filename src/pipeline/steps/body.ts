/**
 * Body / query parsing and pricing-input resolution. Everything that reads
 * the request payload lives here: schema parsing, `.validate()` execution,
 * pre-challenge early-body parsing (for body-derived pricing), and the
 * body+price resolution shared by every paid flow.
 */
import { bufferBody, MalformedJsonError, validateBody } from '../body.js';
import { firePluginResponse } from '../../plugin/events.js';
import type { PricingStrategy } from '../../pricing/index.js';
import type { PaymentStrategy } from '../../protocols/types.js';
import type { RouteEntry } from '../../types.js';
import { errorMessage, errorStatus } from './context.js';
import { fail } from './respond.js';
import type { FlowCtx, ParseBodyResult } from './types.js';

export async function parseBody(
  ctx: FlowCtx,
  request: Request = ctx.request,
): Promise<ParseBodyResult> {
  if (!ctx.routeEntry.bodySchema) return { ok: true, data: undefined };
  let raw: unknown;
  try {
    raw = await bufferBody(request);
  } catch (err) {
    if (!(err instanceof MalformedJsonError)) throw err;
    const responseBody = { success: false, error: 'Invalid JSON', issues: [] };
    const response = Response.json(responseBody, { status: 400 });
    firePluginResponse(ctx, response, undefined, responseBody, {
      message: responseBody.error,
      cause: err,
    });
    return { ok: false, response };
  }
  const result = validateBody(raw, ctx.routeEntry.bodySchema);
  if (result.success) return { ok: true, data: result.data };
  const responseBody = { success: false, error: result.error, issues: result.issues };
  const response = Response.json(responseBody, { status: 400 });
  firePluginResponse(ctx, response, raw, responseBody, { message: result.error });
  return { ok: false, response };
}

export type QueryValidationResult = { ok: true; data: unknown } | { ok: false; response: Response };

export function validateQuery(ctx: FlowCtx): QueryValidationResult {
  const { querySchema } = ctx.routeEntry;
  if (!querySchema) return { ok: true, data: undefined };

  const params = Object.fromEntries(new URL(ctx.request.url).searchParams.entries());
  const result = validateBody(params, querySchema);
  if (result.success) return { ok: true, data: result.data };

  const responseBody = { success: false, error: result.error, issues: result.issues };
  const response = Response.json(responseBody, { status: 400 });
  firePluginResponse(ctx, response, params, responseBody, { message: result.error });
  return { ok: false, response };
}

export async function runValidate(ctx: FlowCtx, body: unknown): Promise<Response | null> {
  if (!ctx.routeEntry.validateFn) return null;
  try {
    await ctx.routeEntry.validateFn(body);
    return null;
  } catch (err: unknown) {
    return fail(ctx, errorStatus(err, 400), errorMessage(err, 'Validation failed'), body);
  }
}

export type EarlyBodyResolution =
  | { ok: true; earlyBody: unknown }
  | { ok: false; response: Response };

/**
 * Parse the body before the 402 challenge when body-derived pricing or
 * `.validate()` needs it (and no payment credential is attached yet).
 */
export async function resolveEarlyBody(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  incomingStrategy: PaymentStrategy | null;
}): Promise<EarlyBodyResolution> {
  const { ctx, pricing, incomingStrategy } = args;

  if (!shouldParseBodyEarly(incomingStrategy, ctx.routeEntry, pricing)) {
    return { ok: true, earlyBody: undefined };
  }

  const earlyClone = ctx.request.clone();
  const earlyResult = await parseBody(ctx, earlyClone);
  // Soft-fail: let the 402 challenge use maxPrice / highest tier as fallback.
  if (!earlyResult.ok) return { ok: true, earlyBody: undefined };

  const validateErr = await runValidate(ctx, earlyResult.data);
  if (validateErr) return { ok: false, response: validateErr };

  return { ok: true, earlyBody: earlyResult.data };
}

function shouldParseBodyEarly(
  incomingStrategy: PaymentStrategy | null,
  routeEntry: RouteEntry,
  pricing: PricingStrategy | null,
): boolean {
  if (incomingStrategy) return false;
  if (!routeEntry.bodySchema) return false;
  return (pricing?.needsBody ?? false) || !!routeEntry.validateFn;
}

export type BodyAndPriceResolution =
  | { ok: true; parsedBody: unknown; price: string }
  | { ok: false; response: Response };

/**
 * Parse + validate the body and quote the price — the input to payment
 * verification on every paid flow. `skipBody` (MPP channel-management
 * requests) short-circuits with no body and a surrogate price.
 */
export async function resolveBodyAndPrice(args: {
  ctx: FlowCtx;
  pricing: PricingStrategy | null;
  skipBody?: boolean;
}): Promise<BodyAndPriceResolution> {
  const { ctx, pricing, skipBody = false } = args;

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
