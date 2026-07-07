import { describe, it, expect } from 'vitest';
import { safeCallHandler } from '../src/pipeline/handler.js';
import { HttpError } from '../src/types.js';

describe('safeCallHandler', () => {
  it('plain object → Response.json(result)', async () => {
    const handler = async () => ({ data: 'hello' });
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: 'hello' });
  });

  it('Response passthrough unchanged', async () => {
    const original = Response.json({ custom: true }, { status: 201 });
    const handler = async () => original;
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ custom: true });
  });

  it('thrown Error → 500 with error message', async () => {
    const handler = async () => {
      throw new Error('something broke');
    };
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('something broke');
    expect(body.success).toBe(false);
  });

  it('thrown HttpError(504) → 504 with message', async () => {
    const handler = async () => {
      throw new HttpError('Gateway timeout', 504);
    };
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toBe('Gateway timeout');
  });

  it('thrown Error with .status property → uses that status', async () => {
    const handler = async () => {
      throw Object.assign(new Error('Not found'), { status: 404 });
    };
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });

  it('passes the original thrown error to onError', async () => {
    const error = Object.assign(new Error('Need compensation'), { status: 503 });
    let captured: unknown;
    const handler = async () => {
      throw error;
    };
    const res = await safeCallHandler(handler as never, {}, { onError: (err) => (captured = err) });
    expect(res.status).toBe(503);
    expect(captured).toBe(error);
  });

  it('thrown Error with .status = 400 → 400', async () => {
    const handler = async () => {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    };
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(400);
  });

  it('thrown non-Error → 500 with Internal error', async () => {
    const handler = async () => {
      throw 'string error';
    };
    const res = await safeCallHandler(handler as never, {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal error');
  });
});
