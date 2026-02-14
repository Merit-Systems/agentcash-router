import { NextRequest } from 'next/server';
import { KNOWN_PAYER } from './x402-server.js';

const BASE_URL = 'http://localhost:3000/api/test';

export function makeRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const { method = 'POST', url = BASE_URL, headers = {}, body } = options;

  return new NextRequest(url, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

export function withX402Payment(
  options: {
    payer?: string;
    amount?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const payer = options.payer ?? KNOWN_PAYER;
  // Simulate encoded payment header — in real x402, this is base64-encoded
  // For the fake, we encode the payer address so FakeX402Server can decode it
  const paymentPayload = Buffer.from(
    JSON.stringify({ payer, amount: options.amount ?? '0.02' }),
  ).toString('base64');

  return makeRequest({
    headers: {
      'PAYMENT-SIGNATURE': paymentPayload,
      ...options.headers,
    },
    body: options.body,
  });
}

export function withSIWX(
  options: {
    wallet?: string;
    nonce?: string;
    body?: unknown;
  } = {},
): NextRequest {
  const wallet = options.wallet ?? '0xSIWX_WALLET';
  const payload = Buffer.from(
    JSON.stringify({ wallet, nonce: options.nonce ?? 'test-nonce' }),
  ).toString('base64');

  return makeRequest({
    headers: {
      'SIGN-IN-WITH-X': payload,
    },
    body: options.body,
  });
}

export function withApiKey(
  key: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  return makeRequest({
    headers: {
      'X-API-Key': key,
      ...options.headers,
    },
    body: options.body,
  });
}
