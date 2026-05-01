import type { NextRequest } from 'next/server';
import type { RouteEntry } from '../../types.js';

export function parseQuery(request: NextRequest, routeEntry: RouteEntry): unknown {
  if (!routeEntry.querySchema) return undefined;
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = routeEntry.querySchema.safeParse(params);
  return result.success ? result.data : params;
}
