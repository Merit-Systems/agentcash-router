import { describe, expect, it } from 'vitest';
import { sniffMppSessionAction } from '../src/protocols/mpp/credential.js';

function requestWithAuth(auth?: string): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
  });
}

function encodeStandardBase64(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function encodeBase64Url(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

describe('sniffMppSessionAction', () => {
  it('reads a session action from a standard-base64 Payment credential', () => {
    const auth = `Payment ${encodeStandardBase64({ payload: { action: 'close' } })}`;
    expect(sniffMppSessionAction(requestWithAuth(auth))).toBe('close');
  });

  it('reads a session action from an unpadded base64url Payment credential', () => {
    const auth = `Payment ${encodeBase64Url({ payload: { action: 'topUp' }, source: 'did:x:0xabc' })}`;
    expect(sniffMppSessionAction(requestWithAuth(auth))).toBe('topUp');
  });

  it('returns undefined for non-session payloads', () => {
    const auth = `Payment ${encodeStandardBase64({ payload: { type: 'hash' } })}`;
    expect(sniffMppSessionAction(requestWithAuth(auth))).toBeUndefined();
  });

  it('returns undefined for unrecognized actions', () => {
    const auth = `Payment ${encodeStandardBase64({ payload: { action: 'detonate' } })}`;
    expect(sniffMppSessionAction(requestWithAuth(auth))).toBeUndefined();
  });

  it('returns undefined for malformed credentials instead of throwing', () => {
    expect(sniffMppSessionAction(requestWithAuth('Payment not!base64'))).toBeUndefined();
  });

  it('returns undefined without an MPP Payment Authorization header', () => {
    expect(sniffMppSessionAction(requestWithAuth())).toBeUndefined();
    expect(sniffMppSessionAction(requestWithAuth('Bearer token123'))).toBeUndefined();
  });
});
