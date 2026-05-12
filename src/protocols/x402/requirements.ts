import type { PaymentRequirements } from '@x402/core/types';
import type { X402ResolvedAccept, X402Server } from '../../types.js';
import { buildEvmExactOptions, buildEvmUptoOptions, isEvmNetwork } from './evm.js';
import { buildSolanaExactOptions, isSolanaRequirement } from './solana.js';

export async function buildExpectedRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const sdkRequirements = await buildSdkHandledRequirements(server, request, price, accepts);
  const customRequirements = buildCustomRequirements(price, accepts);
  return [...sdkRequirements, ...customRequirements];
}

async function buildSdkHandledRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const groups = [
    buildEvmExactOptions(accepts, price),
    buildEvmUptoOptions(accepts, price),
    buildSolanaExactOptions(accepts, price),
  ].filter((options) => options.length > 0);

  if (groups.length === 0) return [];

  const requirements: PaymentRequirements[] = [];
  const failures: Error[] = [];

  for (const options of groups) {
    try {
      requirements.push(
        ...(await server.buildPaymentRequirementsFromOptions(options, { request })),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failures.push(err);
      if (groups.length === 1) {
        throw err;
      }
      console.warn(
        `[router] Failed to build x402 ${options[0]?.scheme} requirements for ${options[0]?.network}: ${err.message}`,
      );
    }
  }

  if (requirements.length > 0) {
    return requirements;
  }

  throw failures[0] ?? new Error('Failed to build x402 SDK-handled requirements');
}

function buildCustomRequirements(
  price: string,
  accepts: X402ResolvedAccept[],
): PaymentRequirements[] {
  return accepts
    .filter((accept) => !isSdkHandled(accept))
    .map((accept) => buildCustomRequirement(price, accept));
}

function isSdkHandled(accept: X402ResolvedAccept): boolean {
  if (isEvmNetwork(accept.network)) {
    return accept.scheme === 'exact' || accept.scheme === 'upto';
  }
  if (isSolanaRequirement({ network: accept.network } as PaymentRequirements)) {
    return accept.scheme === 'exact';
  }
  return false;
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
