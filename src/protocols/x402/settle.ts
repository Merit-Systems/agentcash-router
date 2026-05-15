import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { X402Server } from '../../types.js';

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

export function tagBareDecimalAsDollars(amount: string): string {
  if (/^\d+(?:\.\d+)?$/.test(amount)) return `$${amount}`;
  return amount;
}
