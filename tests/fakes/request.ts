import { KNOWN_PAYER } from './x402-server.js';

const BASE_URL = 'http://localhost:3000/api/test';

function makeRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Request {
  const { method = 'POST', url = BASE_URL, headers = {}, body } = options;

  return new Request(url, {
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
): Request {
  const payer = options.payer ?? KNOWN_PAYER;
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
