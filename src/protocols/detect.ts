import { AUTH_SCHEME, HEADERS } from '../headers.js';

export type DetectedProtocol = 'x402' | 'mpp' | 'siwx';

export function detectProtocol(request: Request): DetectedProtocol | null {
  // x402: highest priority
  if (
    request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
    request.headers.get(HEADERS.X402_PAYMENT_LEGACY)
  ) {
    return 'x402';
  }

  // MPP: Authorization header with Payment credential
  const auth = request.headers.get(HEADERS.AUTHORIZATION);
  if (auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT)) {
    return 'mpp';
  }

  // SIWX
  if (request.headers.get(HEADERS.SIWX)) {
    return 'siwx';
  }

  return null;
}
