import { describe, it, expect } from 'vitest';
import { detectProtocol } from '../src/protocols/detect.js';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://test.com', {
    method: 'POST',
    headers,
  });
}

describe('detectProtocol', () => {
  it('PAYMENT-SIGNATURE header → x402', () => {
    expect(detectProtocol(makeRequest({ 'PAYMENT-SIGNATURE': 'abc' }))).toBe('x402');
  });

  it('X-PAYMENT header → x402', () => {
    expect(detectProtocol(makeRequest({ 'X-PAYMENT': 'abc' }))).toBe('x402');
  });

  it('Authorization with MPP credential → mpp', () => {
    expect(detectProtocol(makeRequest({ Authorization: 'Payment id=abc realm=test' }))).toBe('mpp');
  });

  it('SIGN-IN-WITH-X header → siwx', () => {
    expect(detectProtocol(makeRequest({ 'SIGN-IN-WITH-X': 'abc' }))).toBe('siwx');
  });

  it('no recognized header → null', () => {
    expect(detectProtocol(makeRequest())).toBeNull();
  });

  it('multiple headers → first match in priority order (x402 > mpp > siwx)', () => {
    expect(
      detectProtocol(
        makeRequest({
          'PAYMENT-SIGNATURE': 'abc',
          Authorization: 'Payment id=abc',
          'SIGN-IN-WITH-X': 'def',
        }),
      ),
    ).toBe('x402');
  });
});
