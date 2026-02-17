import type { NonceStore } from './nonce.js';
import type { RouteEntry } from '../types.js';

/**
 * SIWX verification error codes.
 * Enables clients to auto-retry transient failures (e.g., expired challenge).
 */
export type SiwxErrorCode =
  | 'siwx_missing_header'
  | 'siwx_malformed'
  | 'siwx_expired'
  | 'siwx_nonce_used'
  | 'siwx_invalid_signature';

/** Human-readable error messages for each SIWX error code. */
export const SIWX_ERROR_MESSAGES: Record<SiwxErrorCode, string> = {
  siwx_missing_header: 'Missing SIGN-IN-WITH-X header',
  siwx_malformed: 'Malformed SIWX payload',
  siwx_expired: 'SIWX message expired — request a new challenge',
  siwx_nonce_used: 'Nonce already used — request a new challenge',
  siwx_invalid_signature: 'Invalid signature — wallet mismatch or corrupted proof',
};

export type SiwxResult =
  | { valid: true; wallet: string }
  | { valid: false; wallet: null; code: SiwxErrorCode };

/**
 * Categorize @x402/extensions validation error strings into structured codes.
 * Note: String parsing is fragile — filed upstream issue for structured codes.
 */
function categorizeValidationError(error: string | undefined): SiwxErrorCode {
  if (!error) return 'siwx_malformed';
  const err = error.toLowerCase();

  if (err.includes('expired') || err.includes('message too old')) {
    return 'siwx_expired';
  }
  if (err.includes('nonce validation failed')) {
    return 'siwx_nonce_used';
  }
  return 'siwx_malformed';
}

export async function verifySIWX(
  request: Request,
  _routeEntry: RouteEntry,
  nonceStore: NonceStore,
): Promise<SiwxResult> {
  const { parseSIWxHeader, validateSIWxMessage, verifySIWxSignature } =
    await import('@x402/extensions/sign-in-with-x');

  const header = request.headers.get('SIGN-IN-WITH-X');
  if (!header) {
    return { valid: false, wallet: null, code: 'siwx_missing_header' };
  }

  let payload;
  try {
    payload = parseSIWxHeader(header);
  } catch {
    return { valid: false, wallet: null, code: 'siwx_malformed' };
  }

  const uri = request.url;

  const validation = await validateSIWxMessage(payload, uri, {
    checkNonce: (nonce: string) => nonceStore.check(nonce),
  });

  if (!validation.valid) {
    const code = categorizeValidationError((validation as { error?: string }).error);
    return { valid: false, wallet: null, code };
  }

  const verified = await verifySIWxSignature(payload);
  if (!verified?.valid) {
    return { valid: false, wallet: null, code: 'siwx_invalid_signature' };
  }

  return { valid: true, wallet: verified.address as string };
}

export async function buildSIWXExtension(): Promise<unknown> {
  const { declareSIWxExtension } = await import('@x402/extensions/sign-in-with-x');
  return declareSIWxExtension();
}
