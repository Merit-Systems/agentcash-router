import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createRouter } from '../src/index.js';

describe('router notFound fallback', () => {
  it('returns a rediscovery hint for unmatched API routes', async () => {
    const router = createRouter({
      payeeAddress: '0x1111111111111111111111111111111111111111',
      baseUrl: 'https://stable.example.com/',
    });

    const handler = router.notFound();
    const response = await handler(new NextRequest('https://stable.example.com/api/old/route?x=1'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      code: 'route_not_found',
      error:
        'Route not found. Rediscover this origin and retry with the current discovery document.',
      requestedUrl: 'https://stable.example.com/api/old/route?x=1',
      // The deprecated /.well-known/x402 surface is intentionally absent.
      discovery: {
        openapi: 'https://stable.example.com/openapi.json',
        llmsTxt: 'https://stable.example.com/llms.txt',
      },
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
