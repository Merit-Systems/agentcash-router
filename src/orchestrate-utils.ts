/**
 * Small utility helpers used throughout `orchestrate.ts`. Extracted to keep
 * the request hot-path easier to read top-to-bottom.
 */

import type { X402AcceptConfig } from './types.js';

/**
 * Match a decimal price string like `"0.05"` or `"1.234"`. A leading `$`,
 * trailing `%`, or any non-digit-or-dot suffix means the caller already
 * supplied a tagged form (dollars/percent) or raw atomic — pass through.
 */
export function isDecimalDollarString(s: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(s) && s.includes('.');
}

/**
 * True when a Request likely carries a body. mppx's session `respond` hook
 * gates "management" actions (channel open / voucher POST without body) with
 * a 204 ack — content actions fall through to the user handler.
 */
export function hasRequestBody(request: Request): boolean {
  const cl = request.headers.get('content-length');
  if (cl !== null && cl !== '0') return true;
  if (request.headers.has('transfer-encoding')) return true;
  return false;
}

/**
 * Number of session ticks needed to charge `actualDecimal` USDC given a
 * per-tick cost in decimal form. Rounds up — over-charge by a fraction of
 * a cent rather than under-charge. Both inputs are decimal-dollar strings
 * (e.g. `"0.034"`, `"0.0001"`); USDC is 6-decimal, so we scale to atomic
 * bigints to avoid float rounding.
 */
export function computeSessionTicks(actualDecimal: string, tickDecimal: string): number {
  const actualAtomic = decimalToBigintAtomic(actualDecimal, 6);
  const tickAtomic = decimalToBigintAtomic(tickDecimal, 6);
  if (tickAtomic <= 0n) return 0;
  return Number((actualAtomic + tickAtomic - 1n) / tickAtomic); // ceiling division
}

function decimalToBigintAtomic(amount: string, decimals: number): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!m) return 0n;
  const whole = m[1];
  const fraction = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  return BigInt(`${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0');
}

/**
 * Read a Response body as text via `.clone()` so the original stays
 * consumable for plugin hooks. Returns `''` on read failure.
 */
export async function readResponseAsText(response: Response): Promise<string> {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
}

export function getRequirementNetwork(requirements: unknown, fallback: string): string {
  const network = (requirements as { network?: unknown } | null)?.network;
  return typeof network === 'string' ? network : fallback;
}

export function getRequirementRecipient(requirements: unknown): string | undefined {
  const payTo = (requirements as { payTo?: unknown } | null)?.payTo;
  return typeof payTo === 'string' ? payTo : undefined;
}

export function errorStatus(error: unknown, fallback: number): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : fallback;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function handlerFailureError(response: Response): Error & { status: number } {
  const message = response.statusText || `Handler returned HTTP ${response.status}`;
  return Object.assign(new Error(message), { status: response.status });
}

/** Map a CAIP-2 network identifier to its SIWX signature type. */
export function siwxSignatureType(network: string): 'eip191' | 'ed25519' {
  return network.startsWith('solana:') ? 'ed25519' : 'eip191';
}

/** Unique SIWX-supported chains from x402 accepts, falling back to the default network. */
export function getSupportedChains(
  x402Accepts: X402AcceptConfig[],
  fallbackNetwork: string,
): Array<{ chainId: string; type: 'eip191' | 'ed25519' }> {
  const seen = new Set<string>();
  const chains: Array<{ chainId: string; type: 'eip191' | 'ed25519' }> = [];
  for (const accept of x402Accepts) {
    if (accept.network && !seen.has(accept.network)) {
      seen.add(accept.network);
      chains.push({ chainId: accept.network, type: siwxSignatureType(accept.network) });
    }
  }
  if (chains.length === 0) {
    chains.push({ chainId: fallbackNetwork, type: siwxSignatureType(fallbackNetwork) });
  }
  return chains;
}
