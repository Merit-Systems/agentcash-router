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
  private payeeAddress: string;
  initialized = false;
  settledPayments: Array<{ payload: unknown; requirements: unknown }> = [];

  constructor(payeeAddress = KNOWN_PAYEE) {
    this.payeeAddress = payeeAddress;
  }

  async init() {
    this.initialized = true;
  }

  buildPaymentRequirementsFromOptions(
    options: { price: string; payTo: string; scheme: string; network: string },
    _ctx: unknown,
  ) {
    return [
      {
        scheme: options.scheme,
        network: options.network,
        maxAmountRequired: options.price,
        resource: options.payTo,
        payTo: options.payTo,
      },
    ];
  }

  createPaymentRequiredResponse(
    requirements: unknown[],
    _resource: unknown,
    _error: unknown,
    extensions?: Record<string, unknown>,
  ) {
    return {
      requirements,
      extensions,
      version: 1,
    };
  }

  findMatchingRequirements(available: unknown[], _payload: unknown) {
    return available[0];
  }

  async verifyPayment(payload: { payer: string; amount: string }, _requirements: unknown) {
    if (payload.payer === KNOWN_PAYER) {
      return { isValid: true, payer: payload.payer };
    }
    return { isValid: false, payer: null };
  }

  async settlePayment(payload: unknown, requirements: unknown) {
    this.settledPayments.push({ payload, requirements });
    return {
      success: true,
      payer: KNOWN_PAYER,
      transaction: TX_HASH,
      network: 'eip155:8453',
    };
  }
}
