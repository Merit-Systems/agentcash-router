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
        discovery: {
          openapi: `${normalizedBase}/openapi.json`,
          wellKnown: `${normalizedBase}/.well-known/x402`,
          llmsTxt: `${normalizedBase}/llms.txt`,
        },
      },
      {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, SIGN-IN-WITH-X',
        },
      },
    );
}
