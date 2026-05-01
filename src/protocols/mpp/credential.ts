import { Credential } from 'mppx';
import { getAddress, isAddress } from 'viem';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';

/** MPP credential payload type. 'unknown' covers any future variant. */
export type MppPayloadType = 'transaction' | 'hash' | 'unknown';

export interface MppCredentialInfo {
  credential: NonNullable<ReturnType<typeof Credential.fromRequest>>;
  wallet: string;
  payloadType: MppPayloadType;
}

/** Read and decode the MPP credential from the request. Returns null if the header is missing. */
export function readMppCredential(request: Request): MppCredentialInfo | null {
  const credential = Credential.fromRequest(request);
  if (!credential) return null;

  const wallet = walletFromDid(credential.source ?? '');
  const rawType = (credential.payload as { type?: string } | null)?.type;
  const payloadType: MppPayloadType =
    rawType === 'transaction' ? 'transaction' : rawType === 'hash' ? 'hash' : 'unknown';

  return { credential, wallet, payloadType };
}

/** Extract the wallet address from a `did:pkh:eip155:<chainId>:<address>` source. */
export function walletFromDid(rawSource: string): string {
  const parts = rawSource.split(':');
  const last = parts[parts.length - 1];
  return normalizeWalletAddress(isAddress(last) ? getAddress(last) : rawSource);
}
