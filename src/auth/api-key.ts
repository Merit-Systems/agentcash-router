export async function verifyApiKey(
  request: Request,
  resolver: (key: string) => unknown | Promise<unknown>,
): Promise<{ valid: true; account: unknown } | { valid: false; account: null }> {
  const apiKey =
    request.headers.get('X-API-Key') ?? extractBearerToken(request.headers.get('Authorization'));

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
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}
