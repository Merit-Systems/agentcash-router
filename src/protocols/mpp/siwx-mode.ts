import { walletFromDid } from './credential.js';
import type { Transport } from 'mppx/server';
import type { MppxMiddleware, MppxMiddlewareResponse } from './middleware-types.js';

type MppxInstance = {
  charge: MppxMiddleware<{ amount: string }, Transport.Http>;
};

type ChargeSuccess = Extract<MppxMiddlewareResponse<Transport.Http>, { status: 200 }>;

export type MppSiwxResult =
  | { valid: true; wallet: string; withReceipt: ChargeSuccess['withReceipt'] }
  | { valid: false; challenge: Response };

export async function verifyMppSiwx(request: Request, mppx: MppxInstance): Promise<MppSiwxResult> {
  const result = await mppx.charge({ amount: '0' })(request);

  if (result.status === 402) {
    return { valid: false, challenge: result.challenge };
  }

  const { Credential } = await import('mppx');
  const credential = Credential.fromRequest(request);
  const rawSource = credential?.source ?? '';
  const wallet = await walletFromDid(rawSource);

  return { valid: true, wallet, withReceipt: result.withReceipt };
}
