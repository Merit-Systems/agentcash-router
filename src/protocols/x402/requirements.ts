import type { PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept, X402Server } from '../../types.js';
import { buildEvmExactOptions } from './evm.js';
import { buildSolanaExactOptions } from './solana.js';

/** All non-custom requirements (exact scheme, EVM + Solana) plus custom-scheme requirements. */
export async function buildExpectedRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const exactRequirements = await buildExactRequirements(server, request, price, accepts);
  const customRequirements = buildCustomRequirements(price, accepts);
  return [...exactRequirements, ...customRequirements];
}

async function buildExactRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const exactGroups = [
    buildEvmExactOptions(accepts, price),
    buildSolanaExactOptions(accepts, price),
  ].filter((options) => options.length > 0);

  if (exactGroups.length === 0) return [];

  const requirements: PaymentRequirements[] = [];
  const failures: Error[] = [];

  for (const options of exactGroups) {
    try {
      requirements.push(
        ...(await server.buildPaymentRequirementsFromOptions(options, { request })),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failures.push(err);
      if (exactGroups.length === 1) {
        throw err;
      }
      console.warn(
        `[router] Failed to build x402 exact requirements for ${options[0]?.network}: ${err.message}`,
      );
    }
  }

  if (requirements.length > 0) {
    return requirements;
  }

  throw failures[0] ?? new Error('Failed to build x402 exact requirements');
}

function buildCustomRequirements(
  price: string,
  accepts: X402ResolvedAccept[],
): PaymentRequirements[] {
  return accepts
    .filter((accept) => accept.scheme !== 'exact')
    .map((accept) => buildCustomRequirement(price, accept));
}

function buildCustomRequirement(price: string, accept: X402ResolvedAccept): PaymentRequirements {
  if (!accept.asset) {
    throw new Error(
      `Custom x402 accept '${accept.scheme}' on '${accept.network}' is missing asset`,
    );
  }

  return {
    scheme: accept.scheme,
    network: accept.network as `${string}:${string}`,
    amount: decimalToAtomicUnits(price, accept.decimals ?? 6),
    asset: accept.asset,
    payTo: accept.payTo,
    maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 300,
    extra: accept.extra ?? {},
  };
}

function decimalToAtomicUnits(amount: string, decimals: number): string {
  const match = /^(?<whole>\d+)(?:\.(?<fraction>\d+))?$/.exec(amount);
  if (!match?.groups) {
    throw new Error(`Invalid decimal amount '${amount}'`);
  }

  const whole = match.groups.whole;
  const fraction = match.groups.fraction ?? '';
  if (fraction.length > decimals) {
    throw new Error(`Amount '${amount}' exceeds ${decimals} decimal places`);
  }

  const normalized = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
  return normalized === '' ? '0' : normalized;
}
