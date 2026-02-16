/**
 * Test demonstrating the MPP body consumption bug.
 *
 * Bug: When parseBody() consumes request.body before verifyMPPCredential(),
 * toStandardRequest() tries to create a new Request with the consumed body stream,
 * which fails.
 *
 * Fix: Remove body from toStandardRequest() since MPP only needs headers.
 */

import { describe, it, expect } from 'vitest';

describe('MPP body consumption bug', () => {
  it('demonstrates the bug: cannot create Request with consumed body', async () => {
    // Simulate the flow in orchestrate.ts
    const originalBody = JSON.stringify({ prompt: 'test' });

    // Create initial request with body
    const request = new Request('https://example.com/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Payment mpp-credential-here',
      },
      body: originalBody,
    });

    // Step 1: parseBody() consumes the body (like orchestrate.ts:268)
    const bodyText = await request.text();
    expect(bodyText).toBe(originalBody);

    // Step 2: Now try to create a new Request with the consumed body (the bug)
    // This is what toStandardRequest() was doing with body: request.body
    expect(() => {
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body, // This is the problematic line
        // @ts-expect-error duplex required for streaming
        duplex: 'half',
      });
    }).toThrow(); // Should throw because body stream is consumed
  });

  it('fix: creating Request without body works after consumption', async () => {
    const originalBody = JSON.stringify({ prompt: 'test' });

    const request = new Request('https://example.com/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Payment mpp-credential-here',
      },
      body: originalBody,
    });

    // Consume body first
    await request.text();

    // Creating Request WITHOUT body works fine
    const standardRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      // No body - MPP only needs headers
    });

    // Headers are preserved - this is all MPP needs
    expect(standardRequest.headers.get('Authorization')).toBe('Payment mpp-credential-here');
  });
});
