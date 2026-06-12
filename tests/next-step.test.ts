import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createRouter } from '../src/index.js';
import { RouteRegistry } from '../src/registry.js';
import type { AlertEvent, RouterConfig } from '../src/types.js';

const baseConfig: RouterConfig = {
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

function withAlerts(config: RouterConfig = baseConfig) {
  const alerts: AlertEvent[] = [];
  const router = createRouter({
    ...config,
    plugin: { onAlert: (_ctx, alert) => alerts.push(alert) },
  });
  return { router, alerts };
}

/** Registers a paid GET jobs/{jobId} target plus an unprotected submit route chaining to it. */
function registerSubmitAndJobs(router: ReturnType<typeof createRouter>) {
  router
    .route('jobs/{jobId}')
    .method('GET')
    .siwx()
    .description('Fetch job status')
    .handler(async ({ params }) => ({ jobId: params.jobId, status: 'pending' }));

  router
    .route('submit')
    .unprotected()
    .body(z.object({ video: z.string() }))
    .output(z.object({ jobId: z.string(), status: z.string() }))
    .nextStep({
      route: 'jobs/{jobId}',
      args: (result) => ({ jobId: result.jobId }),
      note: 'Poll every ~5s until status is "complete".',
    })
    .handler(async () => ({ jobId: 'abc123', status: 'pending' }));
}

describe('nextStep runtime injection', () => {
  it('appends a resolved next array to successful JSON responses', async () => {
    const router = createRouter(baseConfig);
    registerSubmitAndJobs(router);

    const res = await router.fetch(
      jsonRequest('https://api.example.com/api/submit', { video: 'cats.mp4' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('abc123');
    expect(body.next).toEqual([
      {
        method: 'GET',
        url: 'https://api.example.com/api/jobs/abc123',
        auth: 'siwx',
        note: 'Poll every ~5s until status is "complete".',
      },
    ]);
  });

  it('derives price from the target entry — fixed string and {min,max} range', async () => {
    const router = createRouter(baseConfig);
    router
      .route('download')
      .paid('0.05')
      .handler(async () => ({ ok: true }));
    router
      .route('render')
      .paid((body: { frames: number }) => `${body.frames * 0.01}`, {
        maxPrice: '0.25',
        minPrice: '0.01',
      })
      .body(z.object({ frames: z.number() }))
      .handler(async () => ({ ok: true }));
    router
      .route('start')
      .unprotected()
      .nextStep({ route: 'download' })
      .nextStep({ route: 'render' })
      .handler(async () => ({ started: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/start', { method: 'POST' }),
    );
    const body = await res.json();
    expect(body.next).toHaveLength(2);
    expect(body.next[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/api/download',
      auth: 'paid',
      price: '0.05',
    });
    expect(body.next[1]).toMatchObject({
      auth: 'paid',
      price: { min: '0.01', max: '0.25' },
    });
  });

  it('omits price for free targets', async () => {
    const router = createRouter(baseConfig);
    router
      .route('status')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('go')
      .unprotected()
      .nextStep({ route: 'status' })
      .handler(async () => ({ ok: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/go', { method: 'POST' }),
    );
    const body = await res.json();
    expect(body.next[0]).not.toHaveProperty('price');
  });

  it('honors when() predicates and drops the next key when all steps are filtered', async () => {
    const router = createRouter(baseConfig);
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('run')
      .unprotected()
      .body(z.object({ done: z.boolean() }))
      .output(z.object({ done: z.boolean() }))
      .nextStep({ route: 'poll', when: (result) => !result.done })
      .handler(async ({ body }) => ({ done: body.done }));

    const pending = await (
      await router.fetch(jsonRequest('https://api.example.com/api/run', { done: false }))
    ).json();
    expect(pending.next).toHaveLength(1);

    const finished = await (
      await router.fetch(jsonRequest('https://api.example.com/api/run', { done: true }))
    ).json();
    expect(finished).not.toHaveProperty('next');
  });

  it('maps leftover args to query params on GET targets', async () => {
    const router = createRouter(baseConfig);
    router
      .route('files/{fileId}')
      .method('GET')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('upload')
      .unprotected()
      .nextStep({ route: 'files/{fileId}', args: () => ({ fileId: 'f 1', format: 'png' }) })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/upload', { method: 'POST' }))
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/api/files/f%201?format=png');
    expect(body.next[0]).not.toHaveProperty('body');
  });

  it('maps leftover args to a body suggestion on POST targets', async () => {
    const router = createRouter(baseConfig);
    router
      .route('jobs/{jobId}/cancel')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('begin')
      .unprotected()
      .nextStep({
        route: 'jobs/{jobId}/cancel',
        args: () => ({ jobId: 'j1', reason: 'user-requested' }),
      })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/begin', { method: 'POST' }))
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/api/jobs/j1/cancel');
    expect(body.next[0].body).toEqual({ reason: 'user-requested' });
  });

  it('emits the unresolved template URL when args is omitted', async () => {
    const router = createRouter(baseConfig);
    router
      .route('jobs/{jobId}')
      .method('GET')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('kickoff')
      .unprotected()
      .nextStep({ route: 'jobs/{jobId}' })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/kickoff', { method: 'POST' }))
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/api/jobs/{jobId}');
  });

  it('never overrides a handler-supplied next key', async () => {
    const router = createRouter(baseConfig);
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('custom')
      .unprotected()
      .nextStep({ route: 'poll' })
      .handler(async () => ({ ok: true, next: 'mine' }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/custom', { method: 'POST' }))
    ).json();
    expect(body.next).toBe('mine');
  });

  it('skips injection for raw Response and non-object results', async () => {
    const router = createRouter(baseConfig);
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('raw')
      .unprotected()
      .nextStep({ route: 'poll' })
      .handler(async () => Response.json({ raw: true }));
    router
      .route('list')
      .unprotected()
      .nextStep({ route: 'poll' })
      .handler(async () => [1, 2, 3]);

    const rawBody = await (
      await router.fetch(new Request('https://api.example.com/api/raw', { method: 'POST' }))
    ).json();
    expect(rawBody).toEqual({ raw: true });

    const listBody = await (
      await router.fetch(new Request('https://api.example.com/api/list', { method: 'POST' }))
    ).json();
    expect(listBody).toEqual([1, 2, 3]);
  });

  it('skips injection on handler error responses', async () => {
    const router = createRouter(baseConfig);
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('boom')
      .unprotected()
      .nextStep({ route: 'poll' })
      .handler(async () => {
        throw Object.assign(new Error('nope'), { status: 409 });
      });

    const res = await router.fetch(
      new Request('https://api.example.com/api/boom', { method: 'POST' }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).not.toHaveProperty('next');
  });

  it('skips a missing target at response time and reports a warning', async () => {
    const { router, alerts } = withAlerts();
    router
      .route('orphan')
      .unprotected()
      .nextStep({ route: 'not/registered' })
      .handler(async () => ({ ok: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/orphan', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('next');
    expect(alerts).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining("nextStep target 'not/registered' not registered"),
      }),
    );
  });

  it('reports and skips entries whose when()/args() throw, without breaking the response', async () => {
    const { router, alerts } = withAlerts();
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('fragile')
      .unprotected()
      .nextStep({
        route: 'poll',
        when: () => {
          throw new Error('when exploded');
        },
      })
      .nextStep({
        route: 'poll',
        args: () => {
          throw new Error('args exploded');
        },
      })
      .nextStep({ route: 'poll', note: 'survivor' })
      .handler(async () => ({ ok: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/fragile', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toHaveLength(1);
    expect(body.next[0].note).toBe('survivor');
    expect(alerts.map((a) => a.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('when() threw'),
        expect.stringContaining('args() threw'),
      ]),
    );
  });

  it('resolves multi-method target keys deterministically (GET wins)', async () => {
    const router = createRouter(baseConfig);
    router
      .route({ path: 'items/{id}', method: 'DELETE' })
      .unprotected()
      .handler(async () => ({ deleted: true }));
    router
      .route({ path: 'items/{id}', method: 'GET' })
      .unprotected()
      .handler(async () => ({ item: true }));
    router
      .route('make')
      .unprotected()
      .nextStep({ route: 'items/{id}', args: () => ({ id: '7' }) })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/make', { method: 'POST' }))
    ).json();
    expect(body.next[0].method).toBe('GET');
  });

  it('resolves URLs against a custom basePath', async () => {
    const router = createRouter({ ...baseConfig, basePath: 'v1' });
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('start')
      .unprotected()
      .nextStep({ route: 'poll' })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/v1/start', { method: 'POST' }))
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/v1/poll');
  });
});

describe('external nextStep', () => {
  it('injects an external entry with method, url, headers, and body — no auth, no price', async () => {
    const router = createRouter(baseConfig);
    router
      .route('purchase')
      .unprotected()
      .output(z.object({ uploadUrl: z.string(), fileId: z.string() }))
      .nextStep({
        external: (result) => ({
          url: result.uploadUrl,
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream' },
          body: { fileId: result.fileId },
        }),
        note: 'Upload the file bytes to the presigned URL.',
      })
      .handler(async () => ({
        uploadUrl: 'https://s3.example.com/presigned?sig=abc',
        fileId: 'f1',
      }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/purchase', { method: 'POST' }))
    ).json();
    expect(body.next).toEqual([
      {
        external: true,
        method: 'PUT',
        url: 'https://s3.example.com/presigned?sig=abc',
        headers: { 'content-type': 'application/octet-stream' },
        body: { fileId: 'f1' },
        note: 'Upload the file bytes to the presigned URL.',
      },
    ]);
    expect(body.next[0]).not.toHaveProperty('auth');
    expect(body.next[0]).not.toHaveProperty('price');
  });

  it('defaults the external method to GET', async () => {
    const router = createRouter(baseConfig);
    router
      .route('locate')
      .unprotected()
      .nextStep({ external: () => ({ url: 'https://cdn.example.com/file' }) })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/locate', { method: 'POST' }))
    ).json();
    expect(body.next[0]).toEqual({
      external: true,
      method: 'GET',
      url: 'https://cdn.example.com/file',
    });
  });

  it('skips the entry when external() returns null or undefined', async () => {
    const router = createRouter(baseConfig);
    router
      .route('maybe-null')
      .unprotected()
      .nextStep({ external: () => null })
      .handler(async () => ({ ok: true }));
    router
      .route('maybe-undefined')
      .unprotected()
      .nextStep({ external: () => undefined })
      .handler(async () => ({ ok: true }));

    const nullBody = await (
      await router.fetch(new Request('https://api.example.com/api/maybe-null', { method: 'POST' }))
    ).json();
    expect(nullBody).not.toHaveProperty('next');

    const undefinedBody = await (
      await router.fetch(
        new Request('https://api.example.com/api/maybe-undefined', { method: 'POST' }),
      )
    ).json();
    expect(undefinedBody).not.toHaveProperty('next');
  });

  it('reports and skips when external() throws, without breaking the response', async () => {
    const { router, alerts } = withAlerts();
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('fragile-external')
      .unprotected()
      .nextStep({
        external: () => {
          throw new Error('external exploded');
        },
      })
      .nextStep({ route: 'poll', note: 'survivor' })
      .handler(async () => ({ ok: true }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/fragile-external', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toHaveLength(1);
    expect(body.next[0].note).toBe('survivor');
    expect(alerts).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining('nextStep (external): external() threw'),
      }),
    );
  });

  it('honors when() on external steps', async () => {
    const router = createRouter(baseConfig);
    router
      .route('gated')
      .unprotected()
      .body(z.object({ ready: z.boolean() }))
      .output(z.object({ ready: z.boolean() }))
      .nextStep({
        external: () => ({ url: 'https://cdn.example.com/file' }),
        when: (result) => result.ready,
      })
      .handler(async ({ body }) => ({ ready: body.ready }));

    const ready = await (
      await router.fetch(jsonRequest('https://api.example.com/api/gated', { ready: true }))
    ).json();
    expect(ready.next).toHaveLength(1);

    const notReady = await (
      await router.fetch(jsonRequest('https://api.example.com/api/gated', { ready: false }))
    ).json();
    expect(notReady).not.toHaveProperty('next');
  });

  it('registry.validate() ignores external steps', () => {
    const router = createRouter(baseConfig);
    router
      .route('only-external')
      .unprotected()
      .nextStep({ external: () => ({ url: 'https://cdn.example.com/x' }) })
      .handler(async () => ({ ok: true }));

    expect(() => router.registry.validate()).not.toThrow();
  });

  it('throws at registration unless exactly one of route/external is provided', () => {
    const router = createRouter(baseConfig);
    expect(() =>
      router
        .route('both')
        .unprotected()
        .nextStep({
          route: 'poll',
          external: () => ({ url: 'https://x.example.com' }),
        } as never),
    ).toThrow("route 'both': .nextStep() requires exactly one of 'route'");
    expect(() =>
      router
        .route('neither')
        .unprotected()
        .nextStep({ note: 'no target' } as never),
    ).toThrow("route 'neither': .nextStep() requires exactly one of 'route'");
  });

  it('renders external steps as terminal lines in the workflows map', async () => {
    const router = createRouter(baseConfig);
    router
      .route('purchase')
      .paid('0.10')
      .description('Buy an upload slot')
      .nextStep({
        external: () => ({ url: 'https://s3.example.com/presigned', method: 'PUT' }),
        note: 'Upload the file bytes.',
        retryAfterSeconds: 3,
      })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('1. POST /api/purchase ($0.10) — Buy an upload slot');
    expect(text).toContain(
      "2. (external request — resolved in the previous response's next array, retry ~3s) — Upload the file bytes.",
    );
    // External steps terminate static traversal: nothing follows.
    expect(text).not.toContain('3. ');
  });
});

describe('retryAfterSeconds', () => {
  it('throws at registration for non-finite or non-positive values', () => {
    const router = createRouter(baseConfig);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        router.route('bad-retry').unprotected().nextStep({ route: 'poll', retryAfterSeconds: bad }),
      ).toThrow("route 'bad-retry': .nextStep() retryAfterSeconds must be a finite number > 0");
    }
  });

  it('emits retryAfterSeconds verbatim on route and external entries', async () => {
    const router = createRouter(baseConfig);
    router
      .route('poll')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('kick')
      .unprotected()
      .nextStep({ route: 'poll', retryAfterSeconds: 5 })
      .nextStep({
        external: () => ({ url: 'https://cdn.example.com/file' }),
        retryAfterSeconds: 2.5,
      })
      .handler(async () => ({ ok: true }));

    const body = await (
      await router.fetch(new Request('https://api.example.com/api/kick', { method: 'POST' }))
    ).json();
    expect(body.next[0].retryAfterSeconds).toBe(5);
    expect(body.next[1].retryAfterSeconds).toBe(2.5);
  });

  it('renders retry hints in the workflows map access label', async () => {
    const router = createRouter(baseConfig);
    router
      .route('jobs/{jobId}')
      .method('GET')
      .siwx()
      .description('Job status')
      .handler(async () => ({ ok: true }));
    router
      .route('submit')
      .paid('0.01')
      .nextStep({ route: 'jobs/{jobId}', retryAfterSeconds: 5, note: 'Poll until complete' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain(
      '2. GET /api/jobs/{jobId} (siwx, free, retry ~5s) — Poll until complete',
    );
  });
});

describe('request-context args', () => {
  it('threads caller-sent body values into route-form args', async () => {
    const router = createRouter(baseConfig);
    router
      .route('results')
      .unprotected()
      .handler(async () => ({ data: [] }));
    router
      .route('status')
      .unprotected()
      .body(z.object({ token: z.string() }))
      .output(z.object({ status: z.string() }))
      .nextStep({
        route: 'results',
        args: (_result, request) => ({
          token: (request.body as { token: string }).token,
        }),
      })
      .handler(async () => ({ status: 'complete' }));

    const body = await (
      await router.fetch(jsonRequest('https://api.example.com/api/status', { token: 'tok-1' }))
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/api/results');
    expect(body.next[0].body).toEqual({ token: 'tok-1' });
  });

  it('exposes path params and query so a route can chain back to itself', async () => {
    const router = createRouter(baseConfig);
    router
      .route('jobs/{jobId}/status')
      .unprotected()
      .body(z.object({ token: z.string() }))
      .output(z.object({ status: z.string() }))
      .nextStep({
        route: 'jobs/{jobId}/status',
        args: (_result, request) => ({
          jobId: request.params.jobId,
          token: (request.body as { token: string }).token,
        }),
        when: (result) => (result as { status: string }).status === 'pending',
      })
      .handler(async () => ({ status: 'pending' }));

    const body = await (
      await router.fetch(
        jsonRequest('https://api.example.com/api/jobs/j7/status', { token: 'tok-2' }),
      )
    ).json();
    expect(body.next[0].url).toBe('https://api.example.com/api/jobs/j7/status');
    expect(body.next[0].body).toEqual({ token: 'tok-2' });
  });
});

describe('nextStep registry validation', () => {
  it('registry.validate() throws for unregistered nextStep targets', () => {
    const router = createRouter(baseConfig);
    router
      .route('submit')
      .unprotected()
      .nextStep({ route: 'jobs/{jobId}' })
      .handler(async () => ({ ok: true }));

    expect(() => router.registry.validate()).toThrow(
      "nextStep target 'jobs/{jobId}' (from 'submit') not registered — add to barrel imports",
    );
  });

  it('registry.validate() passes once the target is registered', () => {
    const router = createRouter(baseConfig);
    router
      .route('submit')
      .unprotected()
      .nextStep({ route: 'jobs/{jobId}' })
      .handler(async () => ({ ok: true }));
    router
      .route('jobs/{jobId}')
      .method('GET')
      .unprotected()
      .handler(async () => ({ ok: true }));

    expect(() => router.registry.validate()).not.toThrow();
    expect(() => router.registry.validate(['submit'])).not.toThrow();
  });

  it('discovery handlers surface the missing-target error', async () => {
    const router = createRouter(baseConfig);
    router
      .route('submit')
      .unprotected()
      .nextStep({ route: 'missing/target' })
      .handler(async () => ({ ok: true }));

    await expect(
      router.wellKnown()(new Request('https://api.example.com/.well-known/x402')),
    ).rejects.toThrow("nextStep target 'missing/target'");
  });
});

describe('registry.get determinism', () => {
  it('key-only lookup prefers GET over POST over DELETE regardless of registration order', () => {
    const reg = new RouteRegistry();
    const entry = (method: 'GET' | 'POST' | 'DELETE') => ({
      key: 'multi',
      authMode: 'unprotected' as const,
      billing: 'exact' as const,
      protocols: [],
      method,
    });
    reg.register(entry('DELETE'));
    reg.register(entry('POST'));
    reg.register(entry('GET'));
    expect(reg.get('multi')?.method).toBe('GET');

    const reg2 = new RouteRegistry();
    reg2.register(entry('GET'));
    reg2.register(entry('DELETE'));
    reg2.register(entry('POST'));
    expect(reg2.get('multi')?.method).toBe('GET');
    expect(reg2.get('multi', 'DELETE')?.method).toBe('DELETE');
    expect(reg2.has('multi', 'PUT')).toBe(false);
  });
});

describe('nextStep discovery surfaces', () => {
  function chainedRouter(config: RouterConfig = baseConfig) {
    const router = createRouter(config);
    router
      .route('actors/call')
      .paid('0.01')
      .description('Start the run')
      .output(z.object({ runId: z.string() }))
      .nextStep({
        route: 'actors/status',
        args: (result) => ({ runId: result.runId }),
        note: 'Poll until terminal status',
      })
      .handler(async () => ({ runId: 'r1' }));
    router
      .route('actors/status')
      .siwx()
      .description('Run status')
      .nextStep({ route: 'actors/download', note: 'Download once complete' })
      .handler(async () => ({ status: 'complete' }));
    router
      .route('actors/download')
      .method('GET')
      .paid('0.02')
      .description('Download results')
      .handler(async () => ({ data: [] }));
    return router;
  }

  it('OpenAPI carries no static chain copies — only the advertised next key on output schemas', async () => {
    const router = chainedRouter();
    const res = await router.openapi()(new Request('https://api.example.com/openapi.json'));
    const doc = await res.json();

    // Chains live ONLY in runtime response bodies: no x-next, no links.
    const call = doc.paths['/api/actors/call'].post;
    expect(call).not.toHaveProperty('x-next');
    expect(call.responses['200']).not.toHaveProperty('links');

    // But the declared output schema is extended with the injected optional `next`.
    const callSchema = call.responses['200'].content['application/json'].schema;
    expect(callSchema.properties).toHaveProperty('runId');
    expect(callSchema.properties).toHaveProperty('next');
    expect(callSchema.required).not.toContain('next');
    expect(callSchema.properties.next.items.properties).toHaveProperty('url');
    expect(callSchema.properties.next.items.properties).toHaveProperty('price');

    // Routes without .output() or without chains are untouched.
    const download = doc.paths['/api/actors/download'].get;
    expect(download).not.toHaveProperty('x-next');
    expect(download.responses['200']).not.toHaveProperty('links');
  });

  it('well-known carries no workflows array — the map summary lives in llms.txt', async () => {
    const chained = await (
      await chainedRouter().wellKnown()(new Request('https://api.example.com/.well-known/x402'))
    ).json();
    expect(chained).not.toHaveProperty('workflows');
    expect(chained.resources).toContain('https://api.example.com/api/actors/call');
  });

  it('llms.txt workflow chains handle cycles without hanging and cap depth', async () => {
    const router = createRouter(baseConfig);
    router
      .route('a')
      .unprotected()
      .nextStep({ route: 'b' })
      .handler(async () => ({ ok: true }));
    router
      .route('b')
      .unprotected()
      .nextStep({ route: 'a' })
      .handler(async () => ({ ok: true }));
    router
      .route('entry')
      .unprotected()
      .nextStep({ route: 'a' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    // entry → a → b, then b→a stops (a already visited).
    expect(text).toContain('1. POST /api/entry');
    expect(text).toContain('2. POST /api/a');
    expect(text).toContain('3. POST /api/b');
    expect(text).not.toContain('4. ');
  });

  it('llms.txt appends a deterministic Workflows section after the guidance', async () => {
    const router = chainedRouter();
    const res = await router.llmsTxt()(new Request('https://api.example.com/llms.txt'));
    const text = await res.text();

    expect(text).toContain('Use the API.');
    expect(text).toContain('## Workflows');
    expect(text).toContain('1. POST /api/actors/call ($0.01) — Start the run');
    expect(text).toContain('2. POST /api/actors/status (siwx, free) — Poll until terminal status');
    expect(text).toContain('3. GET /api/actors/download ($0.02) — Download once complete');
    expect(text.indexOf('Use the API.')).toBeLessThan(text.indexOf('## Workflows'));
  });

  it('llms.txt omits the Workflows section when there are no chains', async () => {
    const router = createRouter(baseConfig);
    router
      .route('plain')
      .unprotected()
      .handler(async () => ({ ok: true }));
    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toBe('Use the API.');
    expect(text).not.toContain('## Workflows');
  });

  it('mirrors guidance + the Workflows map into OpenAPI info.x-guidance and info.guidance', async () => {
    const router = chainedRouter();
    const doc = await (
      await router.openapi()(new Request('https://api.example.com/openapi.json'))
    ).json();

    expect(doc.info['x-guidance']).toContain('Use the API.');
    expect(doc.info['x-guidance']).toContain('## Workflows');
    expect(doc.info['x-guidance']).toContain('1. POST /api/actors/call ($0.01) — Start the run');
    // Deprecated mirror stays consistent with x-guidance.
    expect(doc.info.guidance).toBe(doc.info['x-guidance']);

    // llms.txt serves the same composed text.
    const llms = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(llms).toBe(doc.info['x-guidance']);
  });

  it('keeps well-known instructions as RAW guidance — no Workflows map', async () => {
    const wellKnown = await (
      await chainedRouter().wellKnown()(new Request('https://api.example.com/.well-known/x402'))
    ).json();
    expect(wellKnown.instructions).toBe('Use the API.');
    expect(wellKnown.instructions).not.toContain('## Workflows');
  });

  it('dedupes isomorphic chains into one representative annotated with the count', async () => {
    const router = createRouter(baseConfig);
    router
      .route('runs/status')
      .method('GET')
      .siwx()
      .description('Run status')
      .handler(async () => ({ status: 'complete' }));
    for (let i = 0; i < 20; i++) {
      router
        .route(`actors/actor-${String(i).padStart(2, '0')}/call`)
        .paid('0.01')
        // Distinct per-route descriptions become the root step's note; they
        // must NOT defeat dedup (only the root varies within a group).
        .description(`Start actor ${i}`)
        .nextStep({ route: 'runs/status', note: 'Poll until done', retryAfterSeconds: 5 })
        .handler(async () => ({ ok: true }));
    }

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    // One representative chain (first root in deterministic order), annotated.
    expect(text).toContain(
      '1. POST /api/actors/actor-00/call ($0.01) — Start actor 0 (and 19 similar routes)',
    );
    expect(text).toContain('2. GET /api/runs/status (siwx, free, retry ~5s) — Poll until done');
    // The other 19 isomorphic roots are not rendered.
    expect(text).not.toContain('actor-01');
    expect(text).not.toContain('actor-19');

    // The same deduped map flows into OpenAPI x-guidance.
    const doc = await (
      await router.openapi()(new Request('https://api.example.com/openapi.json'))
    ).json();
    expect(doc.info['x-guidance']).toContain('(and 19 similar routes)');
  });

  it('bounds the map at 12 distinct chain groups and summarizes the rest', async () => {
    const router = createRouter(baseConfig);
    for (let i = 0; i < 14; i++) {
      const n = String(i).padStart(2, '0');
      router
        .route(`ends/end-${n}`)
        .unprotected()
        .handler(async () => ({ ok: true }));
      router
        .route(`flows/flow-${n}`)
        .unprotected()
        // Distinct notes make every chain its own group.
        .nextStep({ route: `ends/end-${n}`, note: `finish flow ${n}` })
        .handler(async () => ({ ok: true }));
    }

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('1. POST /api/flows/flow-00');
    expect(text).toContain('1. POST /api/flows/flow-11');
    expect(text).not.toContain('flows/flow-12');
    expect(text).not.toContain('flows/flow-13');
    expect(text).toContain('…and 2 more workflows');
  });

  it('threads a custom basePath through every discovery surface', async () => {
    const router = chainedRouter({ ...baseConfig, basePath: 'v2' });

    const wellKnown = await (
      await router.wellKnown()(new Request('https://api.example.com/.well-known/x402'))
    ).json();
    expect(wellKnown.resources).toContain('https://api.example.com/v2/actors/call');

    const openapi = await (
      await router.openapi()(new Request('https://api.example.com/openapi.json'))
    ).json();
    expect(openapi.paths).toHaveProperty('/v2/actors/call');

    const llms = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(llms).toContain('1. POST /v2/actors/call ($0.01)');
  });
});

describe('workflow map price rendering', () => {
  it('trims trailing zeros in rendered prices (next entries keep exact strings)', async () => {
    const router = createRouter(baseConfig);
    router
      .route('quote')
      .paid('0.054000')
      .description('Quote')
      .handler(async () => ({ ok: true }));
    router
      .route('start')
      .unprotected()
      .nextStep({ route: 'quote' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('($0.054)');
    expect(text).not.toContain('0.054000');

    const res = await router.fetch(
      new Request('https://api.example.com/api/start', { method: 'POST' }),
    );
    const body = await res.json();
    expect(body.next[0].price).toBe('0.054000'); // exact string preserved on the edge
  });
});

describe('workflow map for cyclic chain graphs', () => {
  it('self-referential pagination still renders a workflow', async () => {
    const router = createRouter(baseConfig);
    router
      .route('person/search')
      .paid('0.01')
      .description('Search people; paginate via scroll_token')
      .nextStep({ route: 'person/search', note: 'Pass scroll_token for the next page.' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('## Workflows');
    expect(text).toContain('1. POST /api/person/search');
  });

  it('mutual cycles with no pure root render one deterministic chain each', async () => {
    const router = createRouter(baseConfig);
    router
      .route('a/search')
      .unprotected()
      .nextStep({ route: 'b/details' })
      .handler(async () => ({ ok: true }));
    router
      .route('b/details')
      .unprotected()
      .nextStep({ route: 'a/search' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('## Workflows');
    // a/search seeds (alphabetical); b/details is covered by its walk, no second block for it.
    expect(text).toContain('1. POST /api/a/search');
    expect(text).toContain('2. POST /api/b/details');
  });

  it('pure roots still take precedence and cycles reachable from them do not double-render', async () => {
    const router = createRouter(baseConfig);
    router
      .route('entry')
      .unprotected()
      .nextStep({ route: 'loop' })
      .handler(async () => ({ ok: true }));
    router
      .route('loop')
      .unprotected()
      .nextStep({ route: 'loop', note: 'poll again' })
      .handler(async () => ({ ok: true }));

    const text = await (
      await router.llmsTxt()(new Request('https://api.example.com/llms.txt'))
    ).text();
    expect(text).toContain('1. POST /api/entry');
    // 'loop' is reachable from 'entry' — it must not also seed its own chain block.
    expect(text.match(/1\. POST/g)?.length).toBe(1);
  });
});

describe('next key serialization position', () => {
  it('serializes next LAST — handler payload first, router metadata trailing', async () => {
    const router = createRouter(baseConfig);
    router
      .route('target')
      .unprotected()
      .handler(async () => ({ ok: true }));
    router
      .route('source')
      .unprotected()
      .nextStep({ route: 'target' })
      .handler(async () => ({ big: 'x'.repeat(500), more: [1, 2, 3] }));

    const res = await router.fetch(
      new Request('https://api.example.com/api/source', { method: 'POST' }),
    );
    const text = await res.text();
    expect(text.indexOf('"next"')).toBeGreaterThan(text.indexOf('"big"'));
    const body = JSON.parse(text);
    expect(body.next[0].url).toBe('https://api.example.com/api/target');
    expect(body.big.length).toBe(500);
  });
});
