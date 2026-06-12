import type { ProtocolType } from '../types.js';
import { AUTH_SCHEME, HEADERS } from '../headers.js';

export type DetectedProtocol = ProtocolType | 'siwx';

/**
 * Returns the raw x402 payment header (current `PAYMENT-SIGNATURE` or legacy
 * `X-PAYMENT`), or null when the request carries no x402 payment.
 * Single source of truth for x402 header sniffing.
 */
export function readX402PaymentHeader(request: Request): string | null {
  return (
    request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
    request.headers.get(HEADERS.X402_PAYMENT_LEGACY)
  );
}

/**
 * Returns the `Authorization` header value when it carries an MPP `Payment`
 * scheme credential, or null otherwise. Single source of truth for MPP header
 * sniffing.
 */
export function readMppAuthHeader(request: Request): string | null {
  const auth = request.headers.get(HEADERS.AUTHORIZATION);
  return auth?.startsWith(AUTH_SCHEME.MPP_PAYMENT) ? auth : null;
}

export function detectProtocol(request: Request): DetectedProtocol | null {
  if (readX402PaymentHeader(request)) {
    return 'x402';
  }

  if (readMppAuthHeader(request)) {
    return 'mpp';
  }

  if (request.headers.get(HEADERS.SIWX)) {
    return 'siwx';
  }

  return null;
}
