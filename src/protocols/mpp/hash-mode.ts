import type { NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import { HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { SettleArgs, SettleOutcome, VerifyArgs, VerifySuccess } from '../types.js';
import type { MppxMiddlewareResponse } from '../../pipeline/steps/types.js';
import type { MppCredentialInfo } from './credential.js';
import { extractTxHash, readChallengeReason } from './receipt.js';

export interface HashModeToken {
  mode: 'hash';
  charge: Extract<MppxMiddlewareResponse<Transport.Http>, { status: 200 }>;
}

export async function verifyHashMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  VerifySuccess | { ok: false; kind: 'invalid' } | { ok: false; kind: 'config'; message: string }
> {
  const { deps, price, request, report } = args;

  if (!deps.mppx) {
    const reason = deps.mppInitError
      ? `MPP initialization failed: ${deps.mppInitError}`
      : 'MPP not initialized — ensure mppx is installed and mpp config (secretKey, currency, recipient) is correct';
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
    const detail = reason || 'credential may be invalid, or check TEMPO_RPC_URL configuration';
    report('warn', `MPP credential rejected: ${detail}`);
    return { ok: false, kind: 'invalid' };
  }

  const receiptHeader = (chargeResult.withReceipt(new Response()) as Response).headers.get(
    HEADERS.MPP_PAYMENT_RECEIPT,
  );
  const txHash = extractTxHash(receiptHeader);

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
  const { response, payment, token } = args;
  const hashToken = token as HashModeToken;

  const receiptResponse = hashToken.charge.withReceipt(response) as NextResponse;
  receiptResponse.headers.set('Cache-Control', 'private');

  return {
    ok: true,
    response: receiptResponse,
    settledPayment: payment as HandlerPaymentContext & { status: 'settled' },
  };
}
