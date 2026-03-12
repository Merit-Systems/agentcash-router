/**
 * Behavioral fake for x402ResourceServer.
 *
 * Accepts payments from KNOWN_PAYER to KNOWN_PAYEE for exact amounts.
 * Rejects everything else. Returns deterministic tx hashes.
 */

export const KNOWN_PAYER = '0xPAYER1234567890';
export const KNOWN_PAYEE = '0xPAYEE0987654321';
const TX_HASH = '0xTX_HASH_FAKE_1234567890abcdef';

export class FakeX402Server {
  initialized = false;
  settledPayments: Array<{ payload: unknown; requirements: unknown }> = [];

  constructor(_payeeAddress = KNOWN_PAYEE) {}

  async init() {
    this.initialized = true;
  }

  buildPaymentRequirementsFromOptions(
    options: Array<{ price: string; payTo: string; scheme: string; network: string }>,
    _ctx: unknown,
  ) {
    return options.map((option) => ({
      scheme: option.scheme,
      network: option.network,
      amount: option.price,
      maxAmountRequired: option.price,
      asset: 'mock-usdc',
      resource: option.payTo,
      payTo: option.payTo,
      maxTimeoutSeconds: 300,
    }));
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

  async settlePayment(payload: unknown, requirements: unknown) {
    this.settledPayments.push({ payload, requirements });
    return {
      success: true,
      payer: KNOWN_PAYER,
      transaction: TX_HASH,
      network: ((requirements as { network?: string } | null)?.network ?? 'eip155:8453') as string,
    };
  }
}
