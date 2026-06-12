import { describe, it, expect } from 'vitest';
import { invokeUnauthed } from '../src/pipeline/flows/invoke.js';
import { createDefaultContext } from '../src/plugin/index.js';
import type { FlowCtx } from '../src/pipeline/steps/types.js';
import type { RouteEntry } from '../src/types.js';
import { HttpError } from '../src/types.js';

function makeFlowCtx(handler: (ctx: unknown) => unknown): FlowCtx {
  const routeEntry: RouteEntry = {
    key: 'test/route',
    authMode: 'unprotected',
    billing: 'exact',
    protocols: [],
    method: 'POST',
  };
  const meta = {
    requestId: 'req-1',
    method: 'POST',
    route: routeEntry.key,
    origin: 'http://localhost',
    referer: null,
    walletAddress: null,
    clientId: null,
    sessionId: null,
    contentType: null,
    headers: {},
    startTime: Date.now(),
  };
  return {
    routeEntry,
    handler: handler as FlowCtx['handler'],
    deps: {} as FlowCtx['deps'],
    request: new Request('http://localhost/api/test/route', { method: 'POST' }),
    meta,
    pluginCtx: createDefaultContext(meta),
    report: () => {},
    query: undefined,
    params: {},
  };
}

async function invoke(handler: (ctx: unknown) => unknown) {
  return invokeUnauthed(makeFlowCtx(handler), null, undefined, undefined);
}

describe('handler invocation (invokeUnauthed)', () => {
  it('plain object → Response.json(result)', async () => {
    const result = await invoke(async () => ({ data: 'hello' }));
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({ data: 'hello' });
    expect(result.rawResult).toEqual({ data: 'hello' });
    expect(result.handlerError).toBeUndefined();
  });

  it('Response passthrough unchanged', async () => {
    const original = Response.json({ custom: true }, { status: 201 });
    const result = await invoke(async () => original);
    expect(result.response).toBe(original);
    expect(result.response.status).toBe(201);
    expect(await result.response.json()).toEqual({ custom: true });
  });

  it('thrown Error → 500 with error message', async () => {
    const result = await invoke(async () => {
      throw new Error('something broke');
    });
    expect(result.response.status).toBe(500);
    const body = await result.response.json();
    expect(body.error).toBe('something broke');
    expect(body.success).toBe(false);
  });

  it('thrown HttpError(504) → 504 with message', async () => {
    const result = await invoke(async () => {
      throw new HttpError('Gateway timeout', 504);
    });
    expect(result.response.status).toBe(504);
    const body = await result.response.json();
    expect(body.error).toBe('Gateway timeout');
  });

  it('thrown Error with .status property → uses that status', async () => {
    const result = await invoke(async () => {
      throw Object.assign(new Error('Not found'), { status: 404 });
    });
    expect(result.response.status).toBe(404);
    const body = await result.response.json();
    expect(body.error).toBe('Not found');
  });

  it('exposes the original thrown error as handlerError', async () => {
    const error = Object.assign(new Error('Need compensation'), { status: 503 });
    const result = await invoke(async () => {
      throw error;
    });
    expect(result.response.status).toBe(503);
    expect(result.handlerError).toBe(error);
  });

  it('thrown Error with .status = 400 → 400', async () => {
    const result = await invoke(async () => {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    });
    expect(result.response.status).toBe(400);
  });

  it('thrown non-Error → 500 with Internal error', async () => {
    const result = await invoke(async () => {
      throw 'string error';
    });
    expect(result.response.status).toBe(500);
    const body = await result.response.json();
    expect(body.error).toBe('Internal error');
  });

  it('async-generator handler without .metered() → 500 streaming error', async () => {
    const result = await invoke(async function* () {
      yield 'chunk';
    });
    expect(result.response.status).toBe(500);
    const body = await result.response.json();
    expect(body.error).toContain('streaming handlers require .metered()');
  });

  it('synchronously thrown error → error envelope', async () => {
    const result = await invoke(() => {
      throw new HttpError('sync boom', 409);
    });
    expect(result.response.status).toBe(409);
    const body = await result.response.json();
    expect(body.error).toBe('sync boom');
  });
});
