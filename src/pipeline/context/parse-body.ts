import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteEntry } from '../../types.js';
import { bufferBody, validateBody } from '../../body.js';
import type { ParseBodyResult } from './types.js';

export async function parseBody(
  request: NextRequest,
  routeEntry: RouteEntry,
): Promise<ParseBodyResult> {
  if (!routeEntry.bodySchema) return { ok: true, data: undefined };
  const raw = await bufferBody(request);
  const result = validateBody(raw, routeEntry.bodySchema);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: result.error, issues: result.issues },
      { status: 400 },
    ),
  };
}
