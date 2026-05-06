import { Credential } from 'mppx';
import { getAddress, isAddress } from 'viem';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';

/** MPP charge-credential payload type. 'unknown' covers any future variant. */
export type MppPayloadType = 'transaction' | 'hash' | 'unknown';

/**
 * Session credentials carry a `payload.action` instead of `payload.type`. The
 * router treats any of these as a session credential — verification and settle
 * are routed through the session middleware (`tempo.session`).
 */
export type MppSessionAction = 'open' | 'topUp' | 'voucher' | 'close';

const SESSION_ACTIONS: ReadonlySet<string> = new Set(['open', 'topUp', 'voucher', 'close']);

export interface MppCredentialInfo {
  credential: NonNullable<ReturnType<typeof Credential.fromRequest>>;
  wallet: string;
  payloadType: MppPayloadType;
  /**
   * When set, the credential is a session lifecycle action and should be
   * routed through `tempo.session` rather than `tempo.charge`. Mutually
   * exclusive with the charge-only `payloadType` values in practice — clients
   * either send a charge credential (transaction/hash) or a session credential.
   */
  sessionAction?: MppSessionAction;
}

/** Read and decode the MPP credential from the request. Returns null if the header is missing. */
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

/** Extract the wallet address from a `did:pkh:eip155:<chainId>:<address>` source. */
export function walletFromDid(rawSource: string): string {
  const parts = rawSource.split(':');
  const last = parts[parts.length - 1];
  return normalizeWalletAddress(isAddress(last) ? getAddress(last) : rawSource);
}
