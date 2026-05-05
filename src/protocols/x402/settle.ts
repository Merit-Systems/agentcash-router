import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { X402Server } from '../../types.js';

export async function settleX402Payment(
  server: X402Server,
  payload: unknown,
  requirements: PaymentRequirements,
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  const result = await server.settlePayment(payload, requirements);
  const encoded = encodePaymentResponseHeader(result);

  return { encoded, result: result as SettleResponse & { transaction?: string } };
}
