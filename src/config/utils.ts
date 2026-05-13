// =============================================================================
// Pure helpers used by `schema.ts`.
// =============================================================================
// Address/URL shape checks, env trimming, and EVM-address derivation. Kept
// dependency-free so they're easy to test and so schema.ts stays focused on
// validation logic.

import { privateKeyToAccount } from 'viem/accounts';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const EVM_PRIVATE_KEY_RE = /^0x[a-fA-F0-9]{64}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ZERO_EVM_ADDRESS_RE = /^0x0{40}$/i;

export function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const isEvmAddress = (v: string) => EVM_ADDRESS_RE.test(v);
export const isEvmPrivateKey = (v: string) => EVM_PRIVATE_KEY_RE.test(v);
export const isPlaceholderEvm = (v: string) => ZERO_EVM_ADDRESS_RE.test(v);
export const isSolanaAddress = (v: string) => SOLANA_ADDRESS_RE.test(v);
export const isX402Network = (v: string) => v.startsWith('eip155:') || v.startsWith('solana:');
export const canonicalizeEvm = (addr: string) => addr.toLowerCase();

/** Returns the colliding address, or null if the keys don't collide / aren't both set. */
export function operatorAddressesCollide(
  opKey: string | undefined,
  fpKey: string | undefined,
): string | null {
  if (!opKey || !fpKey || !isEvmPrivateKey(opKey) || !isEvmPrivateKey(fpKey)) return null;
  const op = privateKeyToAccount(opKey as `0x${string}`).address.toLowerCase();
  const fp = privateKeyToAccount(fpKey as `0x${string}`).address.toLowerCase();
  return op === fp ? op : null;
}

/** Trim whitespace, coerce empty strings to undefined. Non-string values become undefined. */
export function trimAll(raw: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string') {
      out[k] = undefined;
      continue;
    }
    const trimmed = v.trim();
    out[k] = trimmed.length > 0 ? trimmed : undefined;
  }
  return out;
}
