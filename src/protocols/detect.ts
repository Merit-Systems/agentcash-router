import { Credential } from 'mppx';

export type DetectedProtocol = 'x402' | 'mpp' | 'siwx';

export function detectProtocol(request: Request): DetectedProtocol | null {
  // x402: highest priority
  if (request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT')) {
    return 'x402';
  }

  // MPP: Authorization header with Payment credential (RFC 9110 compliant,
  // handles multi-scheme headers like "Bearer x, Payment y")
  const auth = request.headers.get('Authorization');
  if (auth && Credential.extractPaymentScheme(auth)) {
    return 'mpp';
  }

  // SIWX
  if (request.headers.get('SIGN-IN-WITH-X')) {
    return 'siwx';
  }

  return null;
}
