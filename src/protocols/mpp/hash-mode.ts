import type { Transport } from 'mppx/server';
import { HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { SettleArgs, SettleOutcome, VerifyArgs, VerifyOutcome } from '../types.js';
import type { MppxMiddlewareResponse } from './middleware-types.js';
import type { MppCredentialInfo } from './credential.js';
import { extractTxHash, readChallengeReason } from './receipt.js';

export interface HashModeToken {
  mode: 'hash';
  charge: Extract<MppxMiddlewareResponse<Transport.Http>, { status: 200 }>;
}

export async function verifyHashMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<VerifyOutcome> {
  const { deps, price, request, report } = args;

  if (!deps.mppx) {
    const reason = deps.mppInitError
      ? `MPP initialization failed: ${deps.mppInitError}`
      : 'MPP not initialized';
    report('error', reason);
    return { ok: false, kind: 'config', message: reason };
  }

  let chargeResult: Awaited<ReturnType<ReturnType<typeof deps.mppx.charge>>>;
  try {
    chargeResult = await deps.mppx.charge({ amount: price })(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report('error', `MPP charge failed: ${message}`);
    return { ok: false, kind: 'config', message: `MPP payment processing failed: ${message}` };
  }

  if (chargeResult.status === 402) {
    const reason = await readChallengeReason(chargeResult.challenge);
    const detail = reason || 'credential may be invalid, or check your TEMPO_RPC_URL endpoint';
    report('warn', `MPP credential rejected: ${detail}`);
    return { ok: false, kind: 'invalid' };
  }

  // Header-extraction trick: the payment already settled inside charge()
  // above, but mppx only exposes the receipt by stamping a Payment-Receipt
  // header onto a response via withReceipt(). Wrap a throwaway Response here
  // purely to read that header — the real handler response gets its own
  // withReceipt() wrap later in settleHashMode.
  const receiptHeader = (chargeResult.withReceipt(new Response()) as Response).headers.get(
    HEADERS.MPP_PAYMENT_RECEIPT,
  );
  const txHash = await extractTxHash(receiptHeader);

  const mppRecipient = deps.mppRecipient ?? deps.payeeAddress;
  const payment: HandlerPaymentContext & { status: 'settled' } = {
    protocol: 'mpp',
    status: 'settled',
    payer: info.wallet,
    amount: price,
    network: 'tempo:4217',
    ...(mppRecipient ? { recipient: mppRecipient } : {}),
    ...(txHash ? { transaction: txHash } : {}),
    ...(receiptHeader ? { receipt: receiptHeader } : {}),
  };

  return {
    ok: true,
    wallet: info.wallet,
    payment,
    token: { mode: 'hash', charge: chargeResult } satisfies HashModeToken,
    alreadySettled: true,
  };
}

export function settleHashMode(args: SettleArgs): SettleOutcome {
  const { response, payment, token, billedAmount } = args;
  const hashToken = token as HashModeToken;

  // Hash mode settles eagerly at verify time for exactly `payment.amount`
  // (the referenced on-chain payment) — there is nothing left to charge here,
  // so a different `billedAmount` can never be honored. Only exact-billing
  // routes reach this mode, so the two always match today; assert defensively
  // so a future flow passing a partial/over amount fails loudly instead of
  // silently mischarging.
  if (billedAmount !== payment.amount) {
    const message = `MPP hash mode already settled ${payment.amount} at verify time; cannot settle ${billedAmount}`;
    return {
      ok: false,
      error: new Error(message),
      failMessage: message,
      failStatus: 500,
    };
  }

  const receiptResponse = hashToken.charge.withReceipt(response) as Response;
  receiptResponse.headers.set('Cache-Control', 'private');

  return {
    ok: true,
    response: receiptResponse,
    settledPayment: payment as HandlerPaymentContext & { status: 'settled' },
  };
}
