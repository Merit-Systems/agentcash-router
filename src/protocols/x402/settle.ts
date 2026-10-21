import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { X402Server } from '../../types.js';
import { buildReviewsSettlementExtension, REVIEWS } from './reviews.js';

export async function settleX402Payment(
  server: X402Server,
  payload: unknown,
  requirements: PaymentRequirements,
  amountOverride?: { amount?: string },
  options: { reviews?: boolean } = {},
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  const settled =
    amountOverride?.amount !== undefined
      ? await server.settlePayment(payload, requirements, undefined, undefined, {
          amount: tagBareDecimalAsDollars(amountOverride.amount),
        })
      : await server.settlePayment(payload, requirements);
  const result = options.reviews ? withReviewsExtension(settled) : settled;
  return {
    encoded: encodePaymentResponseHeader(result),
    result: result as SettleResponse & { transaction?: string },
  };
}

function withReviewsExtension(result: SettleResponse): SettleResponse {
  if (!result.success) return result;
  const reviews = buildReviewsSettlementExtension(result.transaction);
  if (!reviews) return result;
  return { ...result, extensions: { ...result.extensions, [REVIEWS]: reviews } };
}

export function tagBareDecimalAsDollars(amount: string): string {
  if (/^\d+(?:\.\d+)?$/.test(amount)) return `$${amount}`;
  return amount;
}
