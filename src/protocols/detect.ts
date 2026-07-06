import type { ProtocolType } from '../types.js';
import { AUTH_SCHEME, HEADERS } from '../headers.js';

export type DetectedProtocol = ProtocolType | 'siwx';

/**
 * Single source of truth for "does this request carry an x402 payment?".
 * Shared by `detectProtocol` and `x402Strategy.detects` so a new payment
 * header variant can't desync the two.
 */
export function hasX402Payment(request: Request): boolean {
  return Boolean(
    request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
    request.headers.get(HEADERS.X402_PAYMENT_LEGACY),
  );
}

/**
 * Single source of truth for "does this request carry an MPP credential?".
 * Shared by `detectProtocol` and `mppStrategy.detects`.
 */
export function hasMppPayment(request: Request): boolean {
  const auth = request.headers.get(HEADERS.AUTHORIZATION);
  return Boolean(auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT));
}

export function detectProtocol(request: Request): DetectedProtocol | null {
  if (hasX402Payment(request)) return 'x402';
  if (hasMppPayment(request)) return 'mpp';
  if (request.headers.get(HEADERS.SIWX)) return 'siwx';
  return null;
}
