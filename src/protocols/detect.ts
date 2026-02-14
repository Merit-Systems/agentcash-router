export type DetectedProtocol = 'x402' | 'mpp' | 'siwx';

export function detectProtocol(request: Request): DetectedProtocol | null {
  // x402: highest priority
  if (request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT')) {
    return 'x402';
  }

  // MPP: Authorization header with Payment credential
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Payment ')) {
    return 'mpp';
  }

  // SIWX
  if (request.headers.get('SIGN-IN-WITH-X')) {
    return 'siwx';
  }

  return null;
}
