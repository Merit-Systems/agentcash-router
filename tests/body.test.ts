import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { bufferBody, validateBody } from '../src/body.js';

describe('bufferBody', () => {
  it('parses valid JSON body', async () => {
    const req = new Request('http://test.com', {
      method: 'POST',
      body: JSON.stringify({ query: 'hello' }),
    });
    const result = await bufferBody(req);
    expect(result).toEqual({ query: 'hello' });
  });

  it('returns undefined for empty body', async () => {
    const req = new Request('http://test.com', { method: 'POST' });
    const result = await bufferBody(req);
    expect(result).toBeUndefined();
  });

  it('returns undefined for invalid JSON', async () => {
    const req = new Request('http://test.com', {
      method: 'POST',
      body: 'not json',
    });
    const result = await bufferBody(req);
    expect(result).toBeUndefined();
  });
});

describe('validateBody', () => {
  const schema = z.object({
    query: z.string(),
    limit: z.number().optional(),
  });

  it('returns parsed data on valid input', () => {
    const result = validateBody({ query: 'test' }, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('test');
    }
  });

  it('returns error with issues on invalid input', () => {
    const result = validateBody({ query: 123 }, schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns error when required field missing', () => {
    const result = validateBody({}, schema);
    expect(result.success).toBe(false);
  });

  it('accepts valid optional fields', () => {
    const result = validateBody({ query: 'test', limit: 10 }, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });
});
