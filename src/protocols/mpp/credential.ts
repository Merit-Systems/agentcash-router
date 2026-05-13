import { Credential } from 'mppx';
import { getAddress, isAddress } from 'viem';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';

export type MppPayloadType = 'transaction' | 'hash' | 'unknown';

export type MppSessionAction = 'open' | 'topUp' | 'voucher' | 'close';

const SESSION_ACTIONS: ReadonlySet<string> = new Set(['open', 'topUp', 'voucher', 'close']);

export interface MppCredentialInfo {
  credential: NonNullable<ReturnType<typeof Credential.fromRequest>>;
  wallet: string;
  payloadType: MppPayloadType;
  sessionAction?: MppSessionAction;
}

export function readMppCredential(request: Request): MppCredentialInfo | null {
  const credential = Credential.fromRequest(request);
  if (!credential) return null;

  const wallet = walletFromDid(credential.source ?? '');
  const payload = credential.payload as { type?: string; action?: string } | null;
  const rawType = payload?.type;
  const payloadType: MppPayloadType =
    rawType === 'transaction' ? 'transaction' : rawType === 'hash' ? 'hash' : 'unknown';

  const rawAction = payload?.action;
  const sessionAction =
    typeof rawAction === 'string' && SESSION_ACTIONS.has(rawAction)
      ? (rawAction as MppSessionAction)
      : undefined;

  return {
    credential,
    wallet,
    payloadType,
    ...(sessionAction ? { sessionAction } : {}),
  };
}

export function walletFromDid(rawSource: string): string {
  const parts = rawSource.split(':');
  const last = parts[parts.length - 1];
  return normalizeWalletAddress(isAddress(last) ? getAddress(last) : rawSource);
}
