import type { NonceStore } from './nonce.js';
import type { RouteEntry } from '../types.js';

export async function verifySIWX(
  request: Request,
  _routeEntry: RouteEntry,
  nonceStore: NonceStore,
): Promise<{ valid: true; wallet: string } | { valid: false; wallet: null }> {
  const {
    parseSIWxHeader,
    validateSIWxMessage,
    verifySIWxSignature,
  } = await import('@x402/extensions/sign-in-with-x');

  const header = request.headers.get('SIGN-IN-WITH-X');
  if (!header) return { valid: false, wallet: null };

  const payload = parseSIWxHeader(header);
  const uri = request.url;

  const validation = await validateSIWxMessage(payload, uri, {
    checkNonce: (nonce: string) => nonceStore.check(nonce),
  });

  if (!validation.isValid) {
    return { valid: false, wallet: null };
  }

  const verified = await verifySIWxSignature(payload);
  if (!verified?.isValid) {
    return { valid: false, wallet: null };
  }

  return { valid: true, wallet: verified.address as string };
}

export async function buildSIWXExtension(): Promise<unknown> {
  const { declareSIWxExtension } = await import('@x402/extensions/sign-in-with-x');
  return declareSIWxExtension();
}
