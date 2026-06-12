import { Transaction as TempoTransaction } from 'viem/tempo';
import { call as viemCall } from 'viem/actions';
import { HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { SettleArgs, SettleOutcome, VerifyArgs, VerifyOutcome } from '../types.js';
import type { MppCredentialInfo } from './credential.js';
import { extractTxHash, readChallengeReason } from './receipt.js';

export interface TxModeToken {
  mode: 'transaction';
  credential: MppCredentialInfo['credential'];
}

export async function verifyTxMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<VerifyOutcome> {
  const { deps, price, report } = args;
  if (!deps.tempoClient) {
    return {
      ok: false,
      kind: 'config',
      message: 'tempoClient not configured for MPP transaction-payload mode',
    };
  }

  try {
    const serializedTx = (info.credential.payload as { signature: `0x${string}` }).signature;
    const transaction = TempoTransaction.deserialize(serializedTx) as {
      from?: `0x${string}`;
      calls?: unknown[];
      [key: string]: unknown;
    };
    await viemCall(deps.tempoClient, {
      ...transaction,
      account: transaction.from,
      calls: transaction.calls ?? [],
    } as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report('warn', `MPP simulation failed: ${message}`);
    return { ok: false, kind: 'invalid' };
  }

  const mppRecipient = deps.mppRecipient ?? deps.payeeAddress;
  const payment: HandlerPaymentContext = {
    protocol: 'mpp',
    status: 'verified',
    payer: info.wallet,
    amount: price,
    network: 'tempo:4217',
    ...(mppRecipient ? { recipient: mppRecipient } : {}),
  };

  return {
    ok: true,
    wallet: info.wallet,
    payment,
    token: { mode: 'transaction', credential: info.credential } satisfies TxModeToken,
    alreadySettled: false,
  };
}

export async function settleTxMode(args: SettleArgs): Promise<SettleOutcome> {
  const { request, response, payment, deps, billedAmount, report } = args;

  // MPP tx mode broadcasts the client's pre-signed transaction, whose amount
  // was fixed at signing time — it CANNOT settle a different amount. Only
  // exact-billing routes reach this mode, so `billedAmount` always equals
  // `payment.amount` today; assert that defensively so a future flow passing
  // a partial/over amount fails loudly instead of silently mischarging.
  if (billedAmount !== payment.amount) {
    const message = `MPP transaction mode cannot settle ${billedAmount}; the signed transaction amount is ${payment.amount}`;
    return {
      ok: false,
      error: new Error(message),
      failMessage: message,
      failStatus: 500,
    };
  }

  if (!deps.mppx) {
    return {
      ok: false,
      error: new Error('mppx unavailable'),
      failMessage: 'MPP not initialized',
      failStatus: 500,
    };
  }

  let result: Awaited<ReturnType<ReturnType<typeof deps.mppx.charge>>>;
  try {
    result = await deps.mppx.charge({ amount: payment.amount })(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report('error', `MPP broadcast failed after handler: ${message}`);
    return {
      ok: false,
      error: err,
      failMessage: `MPP payment processing failed: ${message}`,
      failStatus: 500,
    };
  }

  if (result.status === 402) {
    const reason = await readChallengeReason(result.challenge);
    const detail = reason || 'transaction reverted on-chain after handler execution';
    const settlementError = Object.assign(new Error(detail), {
      status: 402,
      detail,
      mppResult: result,
      challenge: result.challenge,
    });
    report('error', `MPP payment failed after handler: ${detail}`);
    return {
      ok: false,
      error: settlementError,
      failMessage: `MPP payment failed: ${detail}`,
      failStatus: 500,
    };
  }

  const receiptResponse = result.withReceipt(response) as Response;
  receiptResponse.headers.set('Cache-Control', 'private');
  const receiptHeader = receiptResponse.headers.get(HEADERS.MPP_PAYMENT_RECEIPT) ?? undefined;
  const txHash = await extractTxHash(receiptHeader);

  const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
    ...payment,
    status: 'settled',
    ...(txHash ? { transaction: txHash } : {}),
    ...(receiptHeader ? { receipt: receiptHeader } : {}),
  };

  return { ok: true, response: receiptResponse, settledPayment };
}
