import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { X402Server } from '../../types.js';

/**
 * Forwards `overrides.amount` to upstream `x402ResourceServer.settlePayment`.
 * The `upto` scheme honors it (Permit2Proxy enforces
 * `actualAmount <= permitted.amount`); other schemes ignore it.
 *
 * Accepts the same forms as upstream: raw atomic units (`'1000'`), percent
 * (`'50%'`), or `$`-tagged dollars (`'$0.05'`). Bare decimal-dollar strings
 * are auto-tagged with `$` so upstream interprets them as dollars.
 */
export async function settleX402Payment(
  server: X402Server,
  payload: unknown,
  requirements: PaymentRequirements,
  amountOverride?: { amount?: string },
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  if (amountOverride?.amount !== undefined) {
    const upstreamTaggedAmount = tagBareDecimalAsDollars(amountOverride.amount);
    const result = await server.settlePayment(payload, requirements, undefined, undefined, {
      amount: upstreamTaggedAmount,
    });
    return {
      encoded: encodePaymentResponseHeader(result),
      result: result as SettleResponse & { transaction?: string },
    };
  }

  const result = await server.settlePayment(payload, requirements);
  return {
    encoded: encodePaymentResponseHeader(result),
    result: result as SettleResponse & { transaction?: string },
  };
}

function tagBareDecimalAsDollars(amount: string): string {
  if (/^\d+\.\d+$/.test(amount)) return `$${amount}`;
  return amount;
}
