import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createRouter } from '../src/index.js';
import type { RouterConfig } from '../src/types.js';

const dummyRequest = new NextRequest('http://localhost:3000/.well-known/x402');

describe('baseUrl http:// auto-upgrade to https://', () => {
  const baseConfig: RouterConfig = {
    payeeAddress: '0x1234567890123456789012345678901234567890',
    network: 'eip155:8453',
    prices: { 'test/route': '0.01' },
    discovery: { title: 'Test', version: '1.0.0' },
  };

  it('does NOT upgrade localhost', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, baseUrl: 'http://localhost:3000' });
    router.route('test/route').handler(async () => ({}));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does NOT upgrade 127.0.0.1', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, baseUrl: 'http://127.0.0.1:3000' });
    router.route('test/route').handler(async () => ({}));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('upgrades http:// to https:// for non-local hosts and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, baseUrl: 'http://stablemedia.dev' });
    router.route('test/route').handler(async () => ({}));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('Auto-upgrading to https://stablemedia.dev');
    warnSpy.mockRestore();
  });

  it('produces https:// URLs in well-known output after upgrade', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, baseUrl: 'http://stablemedia.dev' });
    router.route('test/route').handler(async () => ({}));

    const handler = router.wellKnown();
    const res = await handler(dummyRequest);
    const body = await res.json();

    for (const url of body.resources) {
      expect(url).toMatch(/^https:\/\//);
    }
    expect(body.resources).toContain('https://stablemedia.dev/api/test/route');
    vi.restoreAllMocks();
  });

  it('does not touch already-https URLs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createRouter({ ...baseConfig, baseUrl: 'https://stablemedia.dev' });
    router.route('test/route').handler(async () => ({}));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
