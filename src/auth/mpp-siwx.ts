/**
 * MPP-SIWX: wallet identity auth via MPP challenge-response at $0.
 *
 * The MPP protocol's signed credential proves wallet identity without requiring
 * any funds to move. This lets tempo request handle identity-gated (free) endpoints
 * using its existing MPP signing flow — no SIWX implementation needed on the client.
 *
 * Flow:
 * 1. Request arrives with no Authorization header.
 * 2. Server calls mppx.charge({ amount: '0' }) → gets back a 402 challenge.
 * 3. Server returns 402 with WWW-Authenticate: MPP <challenge> header.
 * 4. Client (tempo) signs the challenge and retries with Authorization: MPP <credential>.
 * 5. Server verifies: mppx.charge({ amount: '0' }) now returns 200.
 * 6. Server extracts wallet from did:pkh credential source, passes to handler.
 *
 * No settlement step — amount is $0, nothing moves.
 */

import { Credential } from 'mppx';
import { isAddress, getAddress } from 'viem';
import { normalizeWalletAddress } from './normalize-wallet.js';

type MppxInstance = {
  charge: (options: { amount: string }) => (request: Request) => Promise<
    | { status: 402; challenge: Response }
    | { status: 200; withReceipt: (response: Response) => Response }
  >;
};

export type MppSiwxResult =
  | { valid: true; wallet: string }
  | { valid: false; challenge: Response };

/**
 * Verify an MPP-SIWX request.
 *
 * Returns the verified wallet address when a valid signed credential is present,
 * or the raw MPP 402 challenge response when no/invalid credential is present
 * (caller should forward the WWW-Authenticate header to the client).
 */
export async function verifyMppSiwx(
  request: Request,
  mppx: MppxInstance,
): Promise<MppSiwxResult> {
  const result = await mppx.charge({ amount: '0' })(request);

  if (result.status === 402) {
    return { valid: false, challenge: result.challenge };
  }

  // Credential verified — extract wallet from did:pkh source.
  // Format: "did:pkh:eip155:<chainId>:<address>"
  const credential = Credential.fromRequest(request);
  const rawSource = credential?.source ?? '';
  const didParts = rawSource.split(':');
  const lastPart = didParts[didParts.length - 1];
  const wallet = normalizeWalletAddress(isAddress(lastPart) ? getAddress(lastPart) : rawSource);

  return { valid: true, wallet };
}
