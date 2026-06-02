import { NextResponse } from 'next/server';
import { validateBody } from '../body.js';
import { firePluginResponse } from '../../plugin/events.js';
import type { FlowCtx } from './types.js';

export type QueryValidationResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

export function validateQuery(ctx: FlowCtx): QueryValidationResult {
  const { querySchema } = ctx.routeEntry;
  if (!querySchema) return { ok: true, data: undefined };

  const params = Object.fromEntries(ctx.request.nextUrl.searchParams.entries());
  const result = validateBody(params, querySchema);
  if (result.success) return { ok: true, data: result.data };

  const responseBody = { success: false, error: result.error, issues: result.issues };
  const response = NextResponse.json(responseBody, { status: 400 });
  firePluginResponse(ctx, response, params, responseBody, { message: result.error });
  return { ok: false, response };
}
