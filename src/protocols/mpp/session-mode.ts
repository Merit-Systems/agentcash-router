/**
 * MPP session-payload mode (payment-channel sessions).
 *
 * The client opens a channel with a `suggestedDeposit` escrow, server meters
 * per-tick charges via signed vouchers, settles cumulative on close. Used for
 * dynamic-priced routes — charge credentials commit the client to a fixed
 * amount before the handler runs and can't honor a post-handler total.
 *
 * verify  → mppx.session(...) returns a 402 challenge or a 200 handle whose
 *           `withReceipt` accepts a Response or an SSE generator.
 * settle  → channel-only credentials get a 204 ack; content credentials drain
 *           `billedTicks` channel charges then yield the handler body.
 */

import type { NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import type { Session } from 'mppx/tempo';
import { HEADERS } from '../../headers.js';
import { decimalToAtomic } from '../../pricing/atomic.js';
import type { HandlerPaymentContext } from '../../types.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  SettleArgs,
  SettleOutcome,
  VerifyArgs,
  VerifySuccess,
} from '../types.js';
import type { MppxMiddlewareResponse } from '../../pipeline/context/types.js';
import type { MppCredentialInfo } from './credential.js';

export interface MppSessionToken {
  mode: 'session';
  /** mppx's verified handle; settle() invokes its `withReceipt` to wrap the response. */
  sessionResult: Extract<MppxMiddlewareResponse<Transport.Sse>, { status: 200 }>;
  /** True for credentials that only advance channel state (close / topUp / bodyless open|voucher). */
  isChannelOnly: boolean;
  tickCost: string;
  credential: MppCredentialInfo['credential'];
}

export async function verifySessionMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  VerifySuccess | { ok: false; kind: 'invalid' } | { ok: false; kind: 'config'; message: string }
> {
  const { request, deps, price, routeEntry } = args;

  if (!deps.mppx?.session || !deps.mppSessionConfig) {
    return {
      ok: false,
      kind: 'config',
      message: 'MPP sessions not configured on this server (set RouterConfig.mpp.session)',
    };
  }

  // builder.ts guarantees tickCost is set on dynamic-priced routes; verify is
  // only reached for session credentials, which the strategy gates to dynamic.
  const tickCost = routeEntry.tickCost!;
  const unitType = routeEntry.unitType;

  type SessionResult = Awaited<ReturnType<ReturnType<NonNullable<typeof deps.mppx.session>>>>;
  let result: SessionResult;
  try {
    result = await deps.mppx.session({
      amount: tickCost,
      unitType,
      suggestedDeposit: price,
    })(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      kind: 'config',
      message: `MPP session verify failed: ${message}`,
    };
  }

  if (result.status === 402) {
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

  const token: MppSessionToken = {
    mode: 'session',
    sessionResult: result,
    isChannelOnly: isChannelOnlyAction(info, request),
    tickCost,
    credential: info.credential,
  };

  return {
    ok: true,
    wallet: info.wallet,
    payment,
    token,
    alreadySettled: false,
  };
}

/**
 * Wraps the handler response into mppx's SSE transport. Channel-only
 * credentials get a 204 ack; content credentials drain `billedTicks` channel
 * charges (one `stream.charge()` per tick — mppx batches them into a single
 * commit) then yield the body. mppx surfaces `payment-need-voucher` events
 * transparently when the channel runs short.
 */
export async function settleSessionMode(args: SettleArgs): Promise<SettleOutcome> {
  const { response, payment, token, billedAmount } = args;
  const sessionToken = token as MppSessionToken;

  if (sessionToken.isChannelOnly) {
    const ack = sessionToken.sessionResult.withReceipt(
      new Response(null, { status: 200 }),
    ) as NextResponse;
    return {
      ok: true,
      response: ack,
      settledPayment: { ...payment, status: 'settled', amount: billedAmount },
    };
  }

  // Handler errors forward through SSE without engaging the metering generator
  // — zero channel charges, but the voucher nonce still advances (correct: the
  // client signed for this request).
  if (response.status >= 400) {
    const wrapped = sessionToken.sessionResult.withReceipt(response) as NextResponse;
    return {
      ok: true,
      response: wrapped,
      settledPayment: { ...payment, status: 'settled', amount: billedAmount },
    };
  }

  const handlerBodyText = await cloneResponseAsText(response);
  const channelChargeCount = Number(
    decimalToAtomic(billedAmount) / decimalToAtomic(sessionToken.tickCost),
  );

  async function* drainTicksThenYieldBody(channel: Session.Sse.SessionController) {
    for (let i = 0; i < channelChargeCount; i++) {
      await channel.charge();
    }
    yield handlerBodyText;
  }

  const sse = sessionToken.sessionResult.withReceipt(drainTicksThenYieldBody) as NextResponse;
  sse.headers.set('Cache-Control', 'private');
  const receiptHeader = sse.headers.get(HEADERS.MPP_PAYMENT_RECEIPT) ?? undefined;

  const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
    ...payment,
    status: 'settled',
    amount: billedAmount,
    ...(receiptHeader ? { receipt: receiptHeader } : {}),
  };

  return { ok: true, response: sse, settledPayment };
}

/**
 * Returns the WWW-Authenticate header for an MPP session 402. `suggestedDeposit`
 * is the escrow amount (typically the route's `maxPrice`); tickCost/unitType
 * come from the route (with deployment fallback).
 */
export async function buildSessionChallenge(
  args: ChallengeArgs & { suggestedDeposit: string },
): Promise<ChallengeContribution> {
  const { request, deps, suggestedDeposit, routeEntry } = args;
  if (!deps.mppx?.session || !deps.mppSessionConfig) return {};

  const tickCost = routeEntry.tickCost!;
  const unitType = routeEntry.unitType;

  try {
    const result = await deps.mppx.session({
      amount: tickCost,
      unitType,
      suggestedDeposit,
    })(request);
    if (result.status === 402) {
      const wwwAuth = result.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
      if (wwwAuth) return { headers: { [HEADERS.WWW_AUTHENTICATE]: wwwAuth } };
    }
  } catch (err) {
    console.warn(
      `[router] MPP session challenge build failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
  return {};
}

async function cloneResponseAsText(response: Response): Promise<string> {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
}

/**
 * Channel-only credentials carry no body to meter — `close`/`topUp`, plus
 * `open`/`voucher` requests with no body. (`open`/`voucher` *with* a body are
 * content requests that also advance the channel.)
 */
function isChannelOnlyAction(info: MppCredentialInfo, request: Request): boolean {
  const action = info.sessionAction;
  if (!action) return false;
  if (action === 'close' || action === 'topUp') return true;
  if ((action === 'open' || action === 'voucher') && !hasRequestBody(request)) return true;
  return false;
}

function hasRequestBody(request: Request): boolean {
  const cl = request.headers.get('content-length');
  if (cl !== null && cl !== '0') return true;
  if (request.headers.has('transfer-encoding')) return true;
  return false;
}
