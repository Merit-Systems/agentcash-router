import type { Credential } from 'mppx';
import { getAddress, isAddress } from 'viem';
import { AUTH_SCHEME } from '../../headers.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { readMppAuthHeader } from '../detect.js';

export type MppPayloadType = 'transaction' | 'hash' | 'unknown';

export type MppSessionAction = 'open' | 'topUp' | 'voucher' | 'close';

const SESSION_ACTIONS: ReadonlySet<string> = new Set(['open', 'topUp', 'voucher', 'close']);

export interface MppCredentialInfo {
  credential: NonNullable<ReturnType<typeof Credential.fromRequest>>;
  wallet: string;
  payloadType: MppPayloadType;
  sessionAction?: MppSessionAction;
}

/**
 * Parses the MPP credential from the request's Authorization header via mppx.
 * Async because mppx is loaded lazily — deployments that never receive MPP
 * traffic must not pay its module-load cost.
 */
export async function readMppCredential(request: Request): Promise<MppCredentialInfo | null> {
  const { Credential } = await import('mppx');
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

/**
 * Synchronously sniffs the session action (`open` / `topUp` / `voucher` /
 * `close`) out of the MPP Payment credential wire format — base64url JSON
 * with the action at `payload.action`.
 *
 * This exists because the strategy `preflight` hook is synchronous (it runs
 * before any async work in the pipeline) while the authoritative credential
 * parse above is async (lazy mppx import). The sniff is a NON-AUTHORITATIVE
 * routing hint only — it decides whether body parsing / the handler can be
 * skipped; verification still goes through mppx, which rejects anything the
 * sniff misread.
 */
export function sniffMppSessionAction(request: Request): MppSessionAction | undefined {
  const auth = readMppAuthHeader(request);
  if (!auth) return undefined;

  try {
    const encoded = auth.slice(AUTH_SCHEME.MPP_PAYMENT.length).trim();
    const parsed = JSON.parse(decodeBase64Url(encoded)) as {
      payload?: { action?: unknown };
    } | null;
    const action = parsed?.payload?.action;
    return typeof action === 'string' && SESSION_ACTIONS.has(action)
      ? (action as MppSessionAction)
      : undefined;
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

export function walletFromDid(rawSource: string): string {
  const parts = rawSource.split(':');
  const last = parts[parts.length - 1];
  return normalizeWalletAddress(isAddress(last) ? getAddress(last) : rawSource);
}
