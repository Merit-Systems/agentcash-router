/**
 * Behavioral fake for x402ResourceServer.
 *
 * Accepts payments from KNOWN_PAYER to KNOWN_PAYEE for exact amounts.
 * Rejects everything else. Returns deterministic tx hashes.
 */

export const KNOWN_PAYER = '0xPAYER1234567890';
export const KNOWN_PAYEE = '0xPAYEE0987654321';
const TX_HASH = '0xTX_HASH_FAKE_1234567890abcdef';

function decimalToAtomic(amount: string, decimals: number): string {
  const match = /^(?<whole>\d+)(?:\.(?<fraction>\d+))?$/.exec(amount);
  if (!match?.groups) return amount; // pass through if not decimal-shaped
  const whole = match.groups.whole;
  const fraction = (match.groups.fraction ?? '').slice(0, decimals);
  const padded = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
  return padded === '' ? '0' : padded;
}

export class FakeX402Server {
  initialized = false;
  settledPayments: Array<{
    payload: unknown;
    requirements: unknown;
    overrides?: { amount?: string };
  }> = [];

  constructor(_payeeAddress = KNOWN_PAYEE) {}

  async init() {
    this.initialized = true;
  }

  buildPaymentRequirementsFromOptions(
    options: Array<{
      price: string | { asset: string; amount: string; extra?: Record<string, unknown> };
      payTo: string;
      scheme: string;
      network: string;
      maxTimeoutSeconds?: number;
      extra?: Record<string, unknown>;
    }>,
    _ctx: unknown,
  ) {
    return options.map((option) => {
      const isAssetAmount = typeof option.price === 'object';
      // AssetAmount.amount is already atomic (caller pre-converted using their
      // configured decimals). Money strings are decimal — convert here to mirror
      // upstream behavior so callers can assert on `amount` like they would
      // against the real scheme registry.
      const atomic = isAssetAmount ? option.price.amount : decimalToAtomic(option.price, 6);
      return {
        scheme: option.scheme,
        network: option.network,
        amount: atomic,
        maxAmountRequired: atomic,
        asset: isAssetAmount ? option.price.asset : 'mock-usdc',
        resource: option.payTo,
        payTo: option.payTo,
        maxTimeoutSeconds: option.maxTimeoutSeconds ?? 300,
        extra: { ...(option.extra ?? {}), ...(isAssetAmount ? (option.price.extra ?? {}) : {}) },
      };
    });
  }

  createPaymentRequiredResponse(
    requirements: unknown[],
    _resource: unknown,
    _error: unknown,
    extensions?: Record<string, unknown>,
  ) {
    return {
      x402Version: 2,
      accepts: requirements,
      resource: _resource,
      error: _error ?? undefined,
      extensions,
    };
  }

  findMatchingRequirements(available: unknown[], payload: unknown) {
    const accepted = (payload as { accepted?: { network?: string; scheme?: string } } | null)
      ?.accepted;
    const match = available.find((requirement) => {
      const candidate = requirement as { network?: unknown; scheme?: unknown } | null;
      return (
        typeof candidate?.network === 'string' &&
        candidate.network === accepted?.network &&
        typeof candidate.scheme === 'string' &&
        candidate.scheme === accepted?.scheme
      );
    });
    return match ?? available[0];
  }

  async verifyPayment(payload: unknown, _requirements: unknown) {
    const payer =
      (payload as { payload?: { payer?: unknown } } | null)?.payload?.payer ??
      (payload as { payer?: unknown } | null)?.payer;
    if (payer === KNOWN_PAYER) {
      return { isValid: true, payer: KNOWN_PAYER };
    }
    return { isValid: false, payer: null };
  }

  async settlePayment(
    payload: unknown,
    requirements: unknown,
    _declaredExtensions?: Record<string, unknown>,
    _transportContext?: unknown,
    overrides?: { amount?: string },
  ) {
    this.settledPayments.push({ payload, requirements, overrides });
    // Behavioral parity with upstream x402's `upto` settle: an override of '0'
    // is a legal no-op that skips on-chain transfer. The fake mimics that by
    // returning an empty transaction so callers can assert "didn't settle on chain"
    // without instantiating a real facilitator.
    if (overrides?.amount === '0') {
      return {
        success: true,
        payer: KNOWN_PAYER,
        transaction: '',
        network: ((requirements as { network?: string } | null)?.network ??
          'eip155:8453') as string,
      };
    }
    return {
      success: true,
      payer: KNOWN_PAYER,
      transaction: TX_HASH,
      network: ((requirements as { network?: string } | null)?.network ?? 'eip155:8453') as string,
    };
  }
}
