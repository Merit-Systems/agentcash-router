import { describe, it, expect } from 'vitest';
import { RouteRegistry } from '../src/registry.js';
import type { RouteEntry } from '../src/types.js';

function makeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    key: 'test/route',
    authMode: 'paid',
    protocols: ['x402'],
    method: 'POST',
    ...overrides,
  };
}

describe('route registration', () => {
  it('registers and retrieves entry', () => {
    const reg = new RouteRegistry();
    const entry = makeEntry();
    reg.register(entry);
    expect(reg.get('test/route')).toBe(entry);
  });

  it('registry entry contains all metadata', () => {
    const reg = new RouteRegistry();
    const entry = makeEntry({
      pricing: '0.02',
      description: 'Test route',
      protocols: ['x402', 'mpp'],
    });
    reg.register(entry);
    const stored = reg.get('test/route')!;
    expect(stored.pricing).toBe('0.02');
    expect(stored.description).toBe('Test route');
    expect(stored.protocols).toEqual(['x402', 'mpp']);
  });

  it('duplicate route key throws at registration', () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry());
    expect(() => reg.register(makeEntry())).toThrow('already registered');
  });

  it('has returns true for registered routes', () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry());
    expect(reg.has('test/route')).toBe(true);
    expect(reg.has('nonexistent')).toBe(false);
  });
});

describe('barrel validation', () => {
  it('passes when all price keys have registered routes', () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));
    reg.register(makeEntry({ key: 'b' }));
    expect(() => reg.validate(['a', 'b'])).not.toThrow();
  });

  it('throws naming the missing route key', () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));
    expect(() => reg.validate(['a', 'missing-route'])).toThrow('missing-route');
  });

  it('no-op when no expected keys provided', () => {
    const reg = new RouteRegistry();
    expect(() => reg.validate()).not.toThrow();
  });

  it('route registered but not in prices map → no error', () => {
    const reg = new RouteRegistry();
    reg.register(makeEntry({ key: 'a' }));
    reg.register(makeEntry({ key: 'extra' }));
    expect(() => reg.validate(['a'])).not.toThrow();
  });
});
