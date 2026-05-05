/**
 * MPP hash-payload mode.
 *
 * The transaction was pre-broadcast by the client; the credential carries the
 * hash and the mppx call simply verifies the on-chain receipt.
 *
 * Flow:
 *   verify  → mppx.charge() verifies the receipt is on-chain. Payment is
 *             already settled when verify returns successfully.
 *   settle  → withReceipt() attaches the Payment-Receipt header. No broadcast.
 */

import type { NextResponse } from 'next/server';
import { HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { SettleArgs, SettleOutcome, VerifyArgs, VerifySuccess } from '../types.js';
import type { MppCredentialInfo } from './credential.js';
import { extractTxHash, readChallengeReason } from './receipt.js';

export interface HashModeToken {
  mode: 'hash';
  charge: { status: 200; withReceipt: (response: Response) => Response };
}

export async function verifyHashMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  VerifySuccess | { ok: false; kind: 'invalid' } | { ok: false; kind: 'config'; message: string }
> {
  const { deps, price, routeEntry, request } = args;

  if (!deps.mppx) {
    const reason = deps.mppInitError
      ? `MPP initialization failed: ${deps.mppInitError}`
      : 'MPP not initialized — ensure mppx is installed and mpp config (secretKey, currency, recipient) is correct';
    console.error(`[router] ${routeEntry.key}: ${reason}`);
    return { ok: false, kind: 'config', message: reason };
  }

  let chargeResult: Awaited<ReturnType<ReturnType<typeof deps.mppx.charge>>>;
  try {
    chargeResult = await deps.mppx.charge({ amount: price })(request);
  } catch (err) {
    // Treat charge() throwing as a config issue (RPC misconfigured, etc.)
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[router] ${routeEntry.key}: MPP charge failed: ${message}`);
    return { ok: false, kind: 'config', message: `MPP payment processing failed: ${message}` };
  }

  if (chargeResult.status === 402) {
    const reason = await readChallengeReason(chargeResult.challenge);
    const detail = reason || 'credential may be invalid, or check TEMPO_RPC_URL configuration';
    console.warn(`[router] ${routeEntry.key}: MPP credential rejected — ${detail}`);
    return { ok: false, kind: 'invalid' };
  }

  // Payment is already settled at verify time. Extract txHash from a dummy
  // Response so we can populate the HandlerPaymentContext.
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
