/**
 * MPP-SIWX: wallet identity auth via MPP challenge-response at $0.
 *
 * The MPP protocol's signed credential proves wallet identity without requiring
 * any funds to move. This lets tempo request handle identity-gated (free)
 * endpoints using its existing MPP signing flow — no SIWX implementation
 * needed on the client.
 *
 * Flow:
 * 1. Request arrives with no Authorization header.
 * 2. Server calls mppx.charge({ amount: '0' }) → 402 challenge.
 * 3. Server returns 402 with WWW-Authenticate: MPP <challenge> header.
 * 4. Client signs the challenge and retries with Authorization: MPP <credential>.
 * 5. Server verifies: mppx.charge({ amount: '0' }) now returns 200.
 * 6. Server extracts wallet from did:pkh credential source, passes to handler.
 *
 * No settlement step — amount is $0, nothing moves.
 */

import { walletFromDid } from './credential.js';
import { Credential } from 'mppx';

type MppxInstance = {
  charge: (options: {
    amount: string;
  }) => (
    request: Request,
  ) => Promise<
    | { status: 402; challenge: Response }
    | { status: 200; withReceipt: (response: Response) => Response }
  >;
};

export type MppSiwxResult =
  | { valid: true; wallet: string; withReceipt: (response: Response) => Response }
  | { valid: false; challenge: Response };

export async function verifyMppSiwx(request: Request, mppx: MppxInstance): Promise<MppSiwxResult> {
  const result = await mppx.charge({ amount: '0' })(request);

  if (result.status === 402) {
    return { valid: false, challenge: result.challenge };
  }

  const credential = Credential.fromRequest(request);
  const rawSource = credential?.source ?? '';
  const wallet = walletFromDid(rawSource);

  return { valid: true, wallet, withReceipt: result.withReceipt };
}
