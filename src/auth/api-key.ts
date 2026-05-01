import { AUTH_SCHEME, HEADERS } from '../headers.js';

export async function verifyApiKey(
  request: Request,
  resolver: (key: string) => unknown | Promise<unknown>,
): Promise<{ valid: true; account: unknown } | { valid: false; account: null }> {
  const apiKey =
    request.headers.get(HEADERS.API_KEY) ??
    extractBearerToken(request.headers.get(HEADERS.AUTHORIZATION));

  if (!apiKey) {
    return { valid: false, account: null };
  }

  const account = await resolver(apiKey);
  if (account == null) {
    return { valid: false, account: null };
  }

  return { valid: true, account };
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  if (header.startsWith(AUTH_SCHEME.BEARER)) return header.slice(AUTH_SCHEME.BEARER.length);
  return null;
}
