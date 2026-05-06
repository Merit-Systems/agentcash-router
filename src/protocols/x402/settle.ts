import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { X402Server } from '../../types.js';

/**
 * `overrides.amount` forwards to upstream `x402ResourceServer.settlePayment`'s
 * 5th arg. The `upto` scheme honors the override (Permit2Proxy enforces
 * `actualAmount <= permitted.amount` on chain); other schemes ignore it.
 *
 * Accepts the same string forms as upstream `SettlementOverrides.amount`:
 * raw atomic units (`'1000'`), percent (`'50%'`), or `$`-tagged dollars
 * (`'$0.05'`). Decimal-dollar strings without a `$` prefix are tagged here
 * before forwarding so upstream interprets them as dollars.
 */
export async function settleX402Payment(
  server: X402Server,
  payload: unknown,
  requirements: PaymentRequirements,
  settlementAmountOverride?: { amount?: string },
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  if (settlementAmountOverride?.amount !== undefined) {
    const normalizedAmount = normalizeOverrideAmount(settlementAmountOverride.amount);
    const result = await server.settlePayment(payload, requirements, undefined, undefined, {
      amount: normalizedAmount,
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

/**
 * Bare decimals (`'0.034'`) are interpreted as decimal-dollars by upstream
 * only when prefixed with `$`. Tag them here so the orchestrator's
 * `effectiveAmount` (also decimal-dollar form) lands correctly. Pre-tagged
 * inputs and percent / atomic forms pass through unchanged.
 */
function normalizeOverrideAmount(amount: string): string {
  if (/^\d+\.\d+$/.test(amount)) return `$${amount}`;
  return amount;
}
