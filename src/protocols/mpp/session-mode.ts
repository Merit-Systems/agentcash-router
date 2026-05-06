/**
 * MPP session-payload mode (payment-channel sessions).
 *
 * Charge credentials commit the client to a fixed amount before the handler
 * runs — they can't honor a post-handler amount commitment. Sessions add a
 * bidirectional moment: client opens a channel with a maxPrice deposit, server
 * meters per-tick charges via signed vouchers, settles cumulative on close.
 * Unused deposit auto-refunds.
 *
 * Flow:
 *   verify  → call `mppx.session({ amount: tickCost, unitType, suggestedDeposit })`.
 *             Returns mppx's challenge (402) on first contact, or a verified
 *             handle whose `withReceipt` accepts an SSE async generator.
 *   settle  → for content actions: drain handler body to text, compute
 *             `ceil(effectiveAmount / tickCost)` ticks, build an async
 *             generator that calls `stream.charge()` N times before yielding
 *             the body, hand to `withReceipt(...)` — mppx auto-converts to
 *             SSE and cycles vouchers transparently. For management actions
 *             (close / topUp / open|voucher with no body): mppx's own
 *             `respond` hook produces a 204 ack; just pass any response and
 *             return its result.
 *
 * Wired in via `protocols/mpp/strategy.ts` — when a credential's
 * `payload.action` is one of `open|voucher|topUp|close`, this module's
 * verify/settle functions handle the request. Callers supply the
 * `effectiveAmount` directly (the post-handler total chosen via `charge()`).
 */

import type { NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import { HEADERS } from '../../headers.js';
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
  /** Underlying mppx session result — used by settle() to wrap the handler response. */
  sessionResult: Extract<MppxMiddlewareResponse<Transport.Sse>, { status: 200 }>;
  /** True for credentials that don't carry a content body (close / topUp / bodyless open|voucher). */
  managementAction: boolean;
  /** Resolved tick cost (decimal-dollar string) for this deployment. */
  tickCost: string;
  credential: MppCredentialInfo['credential'];
}

/**
 * Verify the session credential via mppx and produce a `VerifySuccess` whose
 * token carries the `withReceipt` callback for settle. Returns the 402
 * challenge unchanged when mppx demands one (channel not yet open / voucher
 * exhausted / etc.).
 *
 * `args.price` should be the route's quoted cap (`maxPrice`) — mppx surfaces
 * it as `suggestedDeposit` on the challenge so clients know how much to escrow.
 */
export async function verifySessionMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  VerifySuccess | { ok: false; kind: 'invalid' } | { ok: false; kind: 'config'; message: string }
> {
  const { request, deps, price } = args;

  if (!deps.mppx?.session || !deps.mppSessionConfig) {
    return {
      ok: false,
      kind: 'config',
      message: 'MPP sessions not configured on this server (set RouterConfig.mpp.session)',
    };
  }

  const tickCost = deps.mppSessionConfig.tickCost;
  const unitType = deps.mppSessionConfig.unitType;

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
    // mppx wants the client to advance the channel — surface as 402 challenge.
    // The strategy's caller decides how to deliver this back to the client.
    return { ok: false, kind: 'invalid' };
  }

  // Management actions (channel close, top-up, or bodyless open/voucher) don't
  // produce content — mppx returns a 204 ack via withReceipt. Content actions
  // continue to handler invocation + SSE streaming below.
  const managementAction = isManagementAction(info, request);

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
    managementAction,
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
 * Build the SSE response. Settlement is metered via per-tick `stream.charge()`
 * calls rather than a single transaction — mppx's session `withReceipt` cycles
 * vouchers (`event: payment-need-voucher`) transparently as the channel runs short.
 *
 * For management actions, mppx already wrote the 204 ack into `sessionResult`;
 * we just hand it any response and return mppx's wrapped output.
 *
 * `effectiveAmount` is the post-work amount the caller decided to charge, in
 * decimal-dollar form (e.g. `'0.034'`). `'0'` is legal — emits zero ticks and
 * the channel state advances without funds moving.
 */
export async function settleSessionMode(args: SettleArgs): Promise<SettleOutcome> {
  const { response, payment, token, effectiveAmount } = args;
  const sessionToken = token as MppSessionToken;

  if (sessionToken.managementAction) {
    const ack = sessionToken.sessionResult.withReceipt(
      new Response(null, { status: 200 }),
    ) as NextResponse;
    return {
      ok: true,
      response: ack,
      settledPayment: { ...payment, status: 'settled', amount: effectiveAmount },
    };
  }

  // Content action: drain handler body so we can re-emit it after metering.
  // Handler errors are forwarded without engaging the SSE generator — no
  // `stream.charge()` calls means no funds move (the voucher's nonce still
  // advances, which is correct: the client signed for this request).
  if (response.status >= 400) {
    const wrapped = sessionToken.sessionResult.withReceipt(response) as NextResponse;
    return {
      ok: true,
      response: wrapped,
      settledPayment: { ...payment, status: 'settled', amount: effectiveAmount },
    };
  }

  const handlerBodyText = await readResponseAsText(response);
  const ticks = computeSessionTicks(stripDollarTag(effectiveAmount), sessionToken.tickCost);

  async function* sseGenerator(stream: { charge: () => Promise<void> }) {
    for (let i = 0; i < ticks; i++) {
      await stream.charge();
    }
    yield handlerBodyText;
  }

  const sse = sessionToken.sessionResult.withReceipt(sseGenerator) as NextResponse;
  sse.headers.set('Cache-Control', 'private');
  const receiptHeader = sse.headers.get(HEADERS.MPP_PAYMENT_RECEIPT) ?? undefined;

  const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
    ...payment,
    status: 'settled',
    amount: effectiveAmount,
    ...(receiptHeader ? { receipt: receiptHeader } : {}),
  };

  return { ok: true, response: sse, settledPayment };
}

/**
 * Build the session piece of a 402 challenge. Used in lieu of
 * `mppx.charge(...)` when the route wants to advertise sessions. The caller
 * passes `suggestedDeposit` (typically the route's maxPrice) so the client
 * knows how much to escrow on channel open.
 */
export async function buildSessionChallenge(
  args: ChallengeArgs & { suggestedDeposit: string },
): Promise<ChallengeContribution> {
  const { request, deps, suggestedDeposit } = args;
  if (!deps.mppx?.session || !deps.mppSessionConfig) return {};

  try {
    const result = await deps.mppx.session({
      amount: deps.mppSessionConfig.tickCost,
      unitType: deps.mppSessionConfig.unitType,
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

/**
 * Number of ticks needed to charge `actualDecimal` USDC at `tickDecimal` per tick.
 * Both inputs are decimal-dollar strings (`'0.034'`, `'0.0001'`); USDC is
 * 6-decimal so we scale to atomic bigints to avoid float drift, then ceiling-
 * divide so the operator over-charges by a fraction of a cent rather than under.
 */
export function computeSessionTicks(actualDecimal: string, tickDecimal: string): number {
  const actualAtomic = decimalToBigintAtomic(actualDecimal, 6);
  const tickAtomic = decimalToBigintAtomic(tickDecimal, 6);
  if (tickAtomic <= 0n) return 0;
  return Number((actualAtomic + tickAtomic - 1n) / tickAtomic);
}

function decimalToBigintAtomic(amount: string, decimals: number): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!m) return 0n;
  const whole = m[1];
  const fraction = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  return BigInt(`${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0');
}

function stripDollarTag(amount: string): string {
  return amount.startsWith('$') ? amount.slice(1) : amount;
}

async function readResponseAsText(response: Response): Promise<string> {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
}

/**
 * Management actions don't produce content — they just advance channel state
 * (open with no body, voucher top-up, close). Detected by action type plus a
 * body-presence check: an `open` or `voucher` request *with* a body is a
 * content request that happens to also advance the channel.
 */
function isManagementAction(info: MppCredentialInfo, request: Request): boolean {
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
