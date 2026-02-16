import type { RouteEntry } from '../types.js';

export interface ConstraintResult {
  name: string;
  passed: boolean;
  message: string;
}

export async function checkAllRoutesReturn402(
  routes: RouteEntry[],
  baseUrl: string,
): Promise<ConstraintResult[]> {
  const results: ConstraintResult[] = [];

  for (const route of routes) {
    if (route.authMode !== 'paid') continue;

    const path = route.path ?? `/api/${route.key}`;
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: route.method,
        headers: route.method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: route.method === 'POST' ? '{}' : undefined,
      });

      results.push({
        name: `402:${route.key}`,
        passed: response.status === 402,
        message:
          response.status === 402
            ? `${route.key} correctly returns 402`
            : `${route.key} returned ${response.status}, expected 402`,
      });
    } catch (err: unknown) {
      results.push({
        name: `402:${route.key}`,
        passed: false,
        message: `${route.key} fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return results;
}

export function checkSweepInvariant(buffer: number, sweepThreshold: number): ConstraintResult {
  if (buffer <= 0) {
    return {
      name: 'sweep-invariant',
      passed: false,
      message: `Buffer must be > 0, got ${buffer}`,
    };
  }

  if (sweepThreshold < buffer) {
    return {
      name: 'sweep-invariant',
      passed: false,
      message: `sweepThreshold (${sweepThreshold}) must be >= buffer (${buffer}), otherwise sweeps trigger when balance is below the buffer`,
    };
  }

  return {
    name: 'sweep-invariant',
    passed: true,
    message:
      `Sweep invariant holds by construction: sweep_amount = balance - buffer, ` +
      `so post-sweep balance = buffer ($${buffer}). ` +
      `sweepThreshold ($${sweepThreshold}) >= buffer ($${buffer}) ensures sweeps only trigger when there is excess to sweep.`,
  };
}

export async function checkWalletBalance(
  balanceFn: () => Promise<number>,
  threshold: number,
): Promise<ConstraintResult> {
  try {
    const balance = await balanceFn();
    return {
      name: 'wallet-balance',
      passed: balance >= threshold,
      message:
        balance >= threshold
          ? `Wallet balance $${balance.toFixed(2)} >= $${threshold}`
          : `Wallet balance $${balance.toFixed(2)} < $${threshold} threshold`,
    };
  } catch (err: unknown) {
    return {
      name: 'wallet-balance',
      passed: false,
      message: `Balance check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
