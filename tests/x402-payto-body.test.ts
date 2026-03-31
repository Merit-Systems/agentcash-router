import { describe, expect, it } from 'vitest';
import { resolveX402Accepts } from '../src/x402-config.js';

describe('resolveX402Accepts body forwarding', () => {
  const fakeRequest = new Request('https://example.com');

  it('passes body to payTo callback', async () => {
    let receivedBody: unknown;

    const accepts = await resolveX402Accepts(
      fakeRequest,
      {
        payTo: (_req: Request, body?: unknown) => {
          receivedBody = body;
          return (body as { address: string }).address;
        },
      },
      [{ network: 'eip155:8453', scheme: 'exact' }],
      '0xfallback',
      { address: '0xUserAddress', amount: 5 },
    );

    expect(receivedBody).toEqual({ address: '0xUserAddress', amount: 5 });
    expect(accepts[0].payTo).toBe('0xUserAddress');
  });

  it('falls back to fallbackPayTo when payTo is undefined', async () => {
    const accepts = await resolveX402Accepts(
      fakeRequest,
      {},
      [{ network: 'eip155:8453', scheme: 'exact' }],
      '0xDefaultPayee',
    );

    expect(accepts[0].payTo).toBe('0xDefaultPayee');
  });

  it('uses string payTo directly without body', async () => {
    const accepts = await resolveX402Accepts(
      fakeRequest,
      { payTo: '0xStaticAddress' },
      [{ network: 'eip155:8453', scheme: 'exact' }],
      '0xFallback',
      { address: '0xIgnored' },
    );

    expect(accepts[0].payTo).toBe('0xStaticAddress');
  });
});
