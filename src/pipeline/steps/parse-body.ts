import { bufferBody, MalformedJsonError, validateBody } from '../body.js';
import { firePluginResponse } from '../../plugin/events.js';
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
