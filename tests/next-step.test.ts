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
