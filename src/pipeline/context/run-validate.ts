import type { NextResponse } from 'next/server';
import { errorMessage, errorStatus } from './errors.js';
import { fail } from './fail.js';
import type { FlowCtx } from './types.js';

export async function runValidate(ctx: FlowCtx, body: unknown): Promise<NextResponse | null> {
  if (!ctx.routeEntry.validateFn) return null;
  try {
    await ctx.routeEntry.validateFn(body);
    return null;
  } catch (err: unknown) {
    return fail(ctx, errorStatus(err, 400), errorMessage(err, 'Validation failed'), body);
  }
}
