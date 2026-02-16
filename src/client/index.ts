/**
 * @agentcash/router/client
 *
 * Client-side utilities for SIWX (Sign-In With X) authentication.
 * Use these to authenticate with SIWX-protected endpoints.
 *
 * @example
 * ```ts
 * import { fetchWithSiwx } from '@agentcash/router/client';
 *
 * const response = await fetchWithSiwx('https://api.example.com/protected', {
 *   method: 'GET',
 *   signer: walletClient, // viem WalletClient or PrivateKeyAccount
 * });
 * ```
 */

// Re-export error codes from server for client-side error handling
export type { SiwxErrorCode } from '../auth/siwx.js';
export { SIWX_ERROR_MESSAGES } from '../auth/siwx.js';

/**
 * SIWX challenge structure from 402 response.
 * This is what the server returns in `extensions['sign-in-with-x'].info`.
 */
export interface SiwxChallenge {
  domain: string;
  uri: string;
  version: string;
  chainId: string;
  type: 'eip191' | 'ed25519';
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  statement?: string;
}

/**
 * Chain info from SIWX challenge supportedChains array.
 */
interface SiwxChainInfo {
  chainId: string;
  type: 'eip191' | 'ed25519';
  signatureScheme?: 'eip191' | 'ed25519';
}

/**
 * Full SIWX extension from 402 response body.
 */
interface SiwxExtension {
  info: SiwxChallenge;
  supportedChains?: SiwxChainInfo[];
}

/**
 * Fetch options with SIWX signer.
 * The signer must be compatible with @x402/extensions EVMSigner interface.
 */
export interface FetchWithSiwxOptions extends Omit<RequestInit, 'headers'> {
  /**
   * Wallet signer compatible with viem's WalletClient or PrivateKeyAccount.
   * Must have a `signMessage` method that accepts `{ message: string }`.
   */
  signer: {
    signMessage: (args: { message: string; account?: unknown }) => Promise<string>;
    account?: { address: string };
    address?: string;
  };
  /**
   * Additional headers to include in the request.
   */
  headers?: HeadersInit;
}

/**
 * Fetch a SIWX-protected endpoint with automatic challenge-response handling.
 *
 * 1. Makes initial request
 * 2. If 402 with SIWX challenge, extracts challenge from response
 * 3. Signs the challenge with the provided signer
 * 4. Retries request with SIGN-IN-WITH-X header
 *
 * @example
 * ```ts
 * import { fetchWithSiwx } from '@agentcash/router/client';
 * import { createWalletClient, custom } from 'viem';
 *
 * const walletClient = createWalletClient({
 *   transport: custom(window.ethereum),
 * });
 *
 * const response = await fetchWithSiwx('https://api.example.com/jobs', {
 *   method: 'GET',
 *   signer: walletClient,
 * });
 *
 * const jobs = await response.json();
 * ```
 */
export async function fetchWithSiwx(url: string, options: FetchWithSiwxOptions): Promise<Response> {
  const { signer, headers, ...init } = options;

  // First request — expect 402 with challenge for protected endpoints
  const challengeRes = await fetch(url, {
    ...init,
    headers: headers as HeadersInit,
  });

  // Not a 402 — return as-is (either success or other error)
  if (challengeRes.status !== 402) {
    return challengeRes;
  }

  // Parse challenge from response body
  let body: { extensions?: { 'sign-in-with-x'?: SiwxExtension } };
  try {
    body = await challengeRes.json();
  } catch {
    throw new Error('Expected JSON body in 402 response');
  }

  const siwxExtension = body.extensions?.['sign-in-with-x'];
  if (!siwxExtension) {
    // Not a SIWX challenge — might be a payment challenge, return original response
    // Caller can check response.status and handle accordingly
    throw new Error(
      'Expected SIWX challenge in 402 response. ' +
        'This endpoint may require payment instead of SIWX auth.',
    );
  }

  // Import @x402/extensions dynamically to keep client bundle lean
  const { createSIWxPayload, encodeSIWxHeader } = await import('@x402/extensions/sign-in-with-x');

  // Pick first supported EVM chain, or use challenge info directly
  const chainInfo = siwxExtension.supportedChains?.find((c) => c.type === 'eip191') ?? {
    chainId: siwxExtension.info.chainId,
    type: siwxExtension.info.type,
  };

  // Build complete info for createSIWxPayload
  // Cast to satisfy @x402/extensions types — we trust the server's challenge format
  const completeInfo = {
    ...siwxExtension.info,
    chainId: chainInfo.chainId,
    type: chainInfo.type,
    ...(chainInfo.signatureScheme ? { signatureScheme: chainInfo.signatureScheme } : {}),
  } as Parameters<typeof createSIWxPayload>[0];

  // Create signed payload using @x402/extensions helper
  const payload = await createSIWxPayload(completeInfo, signer);
  const header = encodeSIWxHeader(payload);

  // Retry with auth header
  return fetch(url, {
    ...init,
    headers: {
      ...(headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers),
      'SIGN-IN-WITH-X': header,
    },
  });
}
