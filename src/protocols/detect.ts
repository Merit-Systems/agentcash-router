import type { ProtocolType } from '../types.js';
import { AUTH_SCHEME, HEADERS } from '../headers.js';

export type DetectedProtocol = ProtocolType | 'siwx';

export function detectProtocol(request: Request): DetectedProtocol | null {
  if (
    request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
    request.headers.get(HEADERS.X402_PAYMENT_LEGACY)
  ) {
    return 'x402';
  }

  const auth = request.headers.get(HEADERS.AUTHORIZATION);
  if (auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT)) {
    return 'mpp';
  }

  if (request.headers.get(HEADERS.SIWX)) {
    return 'siwx';
  }

  return null;
}
