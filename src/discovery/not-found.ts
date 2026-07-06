import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function createNotFoundHandler(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  return async (request: NextRequest): Promise<NextResponse> =>
    NextResponse.json(
      {
        success: false,
        code: 'route_not_found',
        error:
          'Route not found. Rediscover this origin and retry with the current discovery document.',
        requestedUrl: request.url,
        // `/.well-known/x402` is deprecated as a discovery recommendation and
        // intentionally not advertised here, though the handler still serves it.
        discovery: {
          openapi: `${normalizedBase}/openapi.json`,
          llmsTxt: `${normalizedBase}/llms.txt`,
        },
      },
      {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-API-Key, SIGN-IN-WITH-X, X-Agent-Identity',
        },
      },
    );
}
