import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRouter } from '../src/index.js';
import { nextHandlers } from '../src/next.js';
import { matchPathParams, toHonoPath } from '../src/path-params.js';

const baseConfig = {
  payeeAddress: '0x1111111111111111111111111111111111111111',
  baseUrl: 'https://api.example.com',
  discovery: { title: 'Test API', version: '1.0.0', guidance: 'Use the API.' },
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('router.fetch (Hono dispatch)', () => {
  it('dispatches a registered route at /{basePath}/{path}', async () => {
    const router = createRouter(baseConfig);
    router
      .route('echo')
      .unprotected()
      .body(z.object({ msg: z.string() }))
      .handler(async ({ body }) => ({ echoed: body.msg }));

    const res = await router.fetch(jsonRequest('https://api.example.com/api/echo', { msg: 'hi' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ echoed: 'hi' });
  });

  it('returns the standard 404 envelope for unmatched requests', async () => {
    const router = createRouter(baseConfig);
    const res = await router.fetch(
      new Request('https://api.example.com/api/nope', { method: 'POST' }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Not found' });
  });

  it('returns 404 for a registered path with the wrong method', async () => {
    const router = createRouter(baseConfig);
    router
      .route('echo')
      .unprotected()
      .handler(async () => ({ ok: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/echo', { method: 'PUT' }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Not found' });
  });

  it('re-registration of the same key+method dispatches to the newest handler', async () => {
    const router = createRouter(baseConfig);
    router
      .route('dup')
      .unprotected()
      .handler(async () => ({ v: 1 }));
    router
      .route('dup')
      .unprotected()
      .handler(async () => ({ v: 2 }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/dup', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ v: 2 });
  });

  it('serves discovery surfaces', async () => {
    const router = createRouter(baseConfig);
    router
      .route('search')
      .paid('0.01')
      .handler(async () => ({ ok: true }));

    const wellKnown = await router.fetch(new Request('https://api.example.com/.well-known/x402'));
    expect(wellKnown.status).toBe(200);
    const wellKnownBody = await wellKnown.json();
    expect(JSON.stringify(wellKnownBody)).toContain('search');

    for (const path of ['/openapi.json', '/api/openapi.json']) {
      const openapi = await router.fetch(new Request(`https://api.example.com${path}`));
      expect(openapi.status).toBe(200);
      const doc = await openapi.json();
      expect(doc.openapi).toBeDefined();
      expect(doc.paths['/api/search']).toBeDefined();
    }

    const llms = await router.fetch(new Request('https://api.example.com/llms.txt'));
    expect(llms.status).toBe(200);
    expect(await llms.text()).toBe('Use the API.');
  });

  it('honors a custom basePath', async () => {
    const router = createRouter({ ...baseConfig, basePath: 'v1' });
    router
      .route('ping')
      .unprotected()
      .handler(async () => ({ ok: true }));

    const hit = await router.fetch(
      new Request('https://api.example.com/v1/ping', { method: 'POST' }),
    );
    expect(hit.status).toBe(200);

    const miss = await router.fetch(
      new Request('https://api.example.com/api/ping', { method: 'POST' }),
    );
    expect(miss.status).toBe(404);

    const openapi = await router.fetch(new Request('https://api.example.com/v1/openapi.json'));
    expect(openapi.status).toBe(200);
  });

  it('exposes the Hono app for mounting', async () => {
    const router = createRouter(baseConfig);
    router
      .route('mounted')
      .unprotected()
      .handler(async () => ({ ok: true }));

    const app = router.hono();
    const res = await app.fetch(
      new Request('https://api.example.com/api/mounted', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('path params', () => {
  it('extracts {param} segments when hosted through router.fetch', async () => {
    const router = createRouter(baseConfig);
    router
      .route('drafts/{draftId}/commit')
      .unprotected()
      .handler(async ({ params }) => ({ id: params.draftId }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/drafts/abc123/commit', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'abc123' });
  });

  it('extracts {param} segments through the standalone handler (per-file mode)', async () => {
    const router = createRouter(baseConfig);
    const handler = router
      .route({ path: 'jobs/{jobId}', method: 'GET' })
      .unprotected()
      .handler(async ({ params }) => ({ job: params.jobId }));

    const res = await handler(new Request('https://api.example.com/api/jobs/xyz'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ job: 'xyz' });
  });

  it('passes an empty params object when the path declares none', async () => {
    const router = createRouter(baseConfig);
    let seen: Record<string, string> | undefined;
    const handler = router
      .route('plain')
      .unprotected()
      .handler(async ({ params }) => {
        seen = params;
        return { ok: true };
      });

    await handler(new Request('https://api.example.com/api/plain', { method: 'POST' }));
    expect(seen).toEqual({});
  });
});

describe('path-params helpers', () => {
  it('converts {param} templates to Hono :param syntax', () => {
    expect(toHonoPath('drafts/{draftId}/commit')).toBe('drafts/:draftId/commit');
    expect(toHonoPath('plain/path')).toBe('plain/path');
  });

  it('matches templates against pathnames tolerating any prefix', () => {
    expect(matchPathParams('drafts/{draftId}/commit', '/api/drafts/abc/commit')).toEqual({
      draftId: 'abc',
    });
    expect(matchPathParams('drafts/{draftId}/commit', '/drafts/abc/commit')).toEqual({
      draftId: 'abc',
    });
    expect(matchPathParams('jobs/{id}', '/v1/jobs/a%20b')).toEqual({ id: 'a b' });
    expect(matchPathParams('plain/path', '/api/plain/path')).toEqual({});
    expect(matchPathParams('drafts/{draftId}/commit', '/api/other/abc/commit')).toEqual({});
  });
});

describe('nextHandlers', () => {
  it('returns one delegating handler per method', async () => {
    const router = createRouter(baseConfig);
    router
      .route('echo')
      .unprotected()
      .body(z.object({ msg: z.string() }))
      .handler(async ({ body }) => ({ echoed: body.msg }));
    router
      .route({ path: 'status', method: 'GET' })
      .unprotected()
      .handler(async () => ({ up: true }));

    const handlers = nextHandlers(router);
    expect(Object.keys(handlers).sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);

    const post = await handlers.POST(
      jsonRequest('https://api.example.com/api/echo', { msg: 'hello' }),
    );
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ echoed: 'hello' });

    const get = await handlers.GET(new Request('https://api.example.com/api/status'));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ up: true });

    const miss = await handlers.DELETE(
      new Request('https://api.example.com/api/echo', { method: 'DELETE' }),
    );
    expect(miss.status).toBe(404);
    expect(await miss.json()).toEqual({ success: false, error: 'Not found' });
  });
});
