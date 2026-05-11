/**
 * MPP session-payload mode (payment-channel sessions).
 *
 * The client opens a channel with a `suggestedDeposit` escrow, server bills
 * per-voucher commitments. Dispatch by `routeEntry.streaming`:
 *
 *   - request-mode (`streaming` false/undefined) → mppx's non-SSE session
 *     middleware (`sessionRequest`). One tick per request, auto-charged at
 *     credential verification. `withReceipt(response)` attaches a
 *     `Payment-Receipt` HTTP header to the handler's response. This is the
 *     spec-aligned "discrete paid unit" mode.
 *   - stream-mode (`streaming` true) → mppx's SSE session middleware
 *     (`sessionStream`). One prepaid tick at verify + per-yield `channel.charge()`
 *     debits in the SSE serve loop. `withReceipt(generator)` wraps the
 *     handler's async iterable as Server-Sent Events with inline voucher
 *     events.
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
  /** True if the route is a streaming async-generator handler (SSE transport). */
  streaming: boolean;
  /**
   * mppx's verified handle. Discriminated by `streaming`: SSE for streaming
   * routes (settle wraps a generator), HTTP for request-mode routes (settle
   * wraps the handler's Response).
   */
  sessionResult:
    | Extract<MppxMiddlewareResponse<Transport.Sse>, { status: 200 }>
    | Extract<MppxMiddlewareResponse<Transport.Http>, { status: 200 }>;
  /** Parsed credential — settle re-derives channel-only status from this + the request. */
  info: MppCredentialInfo;
  tickCost: string;
}

export async function verifySessionMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  VerifySuccess | { ok: false; kind: 'invalid' } | { ok: false; kind: 'config'; message: string }
> {
  const { request, deps, price, routeEntry } = args;

  if (!deps.mppx?.sessionRequest || !deps.mppx?.sessionStream || !deps.mppSessionConfig) {
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
  const streaming = routeEntry.streaming === true;
  const middleware = streaming ? deps.mppx.sessionStream : deps.mppx.sessionRequest;

  // For channel-only credentials (close/topUp, plus the SSE loop's bodyless
  // mid-stream voucher), strip the body from the request handed to mppx so
  // its `captureRequestBodyProbe` reports `hasBody: false` — otherwise mppx's
  // `isSessionContentRequest` heuristic auto-charges a tick on the voucher
  // POST (Session.js:172-183), which consumes the headroom the active SSE
  // serve loop just reserved and crashes it with "reserved voucher coverage
  // is no longer available". mppx's `input.body !== null` check is the
  // upstream version of the same Next.js misclassification we fix locally
  // in `isChannelOnlyAction` / `hasRequestBody`.
  const middlewareRequest = isChannelOnlyAction(info, request)
    ? new Request(request.url, { method: request.method, headers: request.headers })
    : request;

  let result: MppxMiddlewareResponse<Transport.Sse> | MppxMiddlewareResponse<Transport.Http>;
  try {
    result = await middleware({ amount: tickCost, unitType, suggestedDeposit: price })(
      middlewareRequest,
    );
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
    streaming,
    sessionResult: result,
    info,
    tickCost,
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
 * Settle path for non-streaming dynamic session routes. mppx's non-SSE
 * `tempo.session` auto-charges exactly `tickCost` at credential verification
 * (the "discrete paid unit" model per the mpp spec). Settle just wraps the
 * handler's Response with the `Payment-Receipt` header — no draining, no SSE
 * framing.
 *
 * Channel-management credentials (close/topUp/bodyless open|voucher) skip
 * the handler upstream via `preflight()`; settle still attaches the receipt
 * header on a 200 placeholder so the client gets the channel-state ack.
 */
export async function settleSessionMode(args: SettleArgs): Promise<SettleOutcome> {
  const { request, response, payment, token, billedAmount } = args;
  const sessionToken = token as MppSessionToken;

  // Channel-only actions (close/topUp/bodyless open|voucher) come back as a
  // 200 placeholder upstream regardless of whether the route is streaming —
  // they just emit a channel-state receipt with no body. `withReceipt(Response)`
  // works on both SSE and HTTP transports.
  if (isChannelOnlyAction(sessionToken.info, request)) {
    const wrapped = (sessionToken.sessionResult.withReceipt as (r: Response) => Response)(
      new Response(null, { status: 200 }),
    ) as NextResponse;
    return {
      ok: true,
      response: wrapped,
      settledPayment: { ...payment, status: 'settled', amount: billedAmount },
    };
  }

  // Content credentials on streaming routes are handled by `settleStream`
  // upstream (the handler returned an async iterable). If one ever reaches
  // here it's a wiring bug — surface clearly rather than silently producing
  // a non-streaming response on a stream-configured channel.
  if (sessionToken.streaming) {
    return {
      ok: false,
      error: new Error('streaming session content settled via request path'),
      failMessage: 'streaming session content settled via request path',
      failStatus: 500,
    };
  }

  const wrapped = (sessionToken.sessionResult.withReceipt as (r: Response) => Response)(
    response,
  ) as NextResponse;
  wrapped.headers.set('Cache-Control', 'private');
  const receiptHeader = wrapped.headers.get(HEADERS.MPP_PAYMENT_RECEIPT) ?? undefined;

  const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
    ...payment,
    status: 'settled',
    amount: billedAmount,
    ...(receiptHeader ? { receipt: receiptHeader } : {}),
  };

  return { ok: true, response: wrapped, settledPayment };
}

/**
 * Returns the WWW-Authenticate header for an MPP session 402. `suggestedDeposit`
 * is the escrow amount — defaults to `tickCost × depositMultiplier` (configured
 * via `RouterConfig.mpp.session.depositMultiplier`, default 10), or the route's
 * `maxPrice` when set. tickCost/unitType come from the route.
 */
export async function buildSessionChallenge(
  args: ChallengeArgs & { suggestedDeposit: string },
): Promise<ChallengeContribution> {
  const { request, deps, suggestedDeposit, routeEntry } = args;
  if (!deps.mppSessionConfig) return {};
  const streaming = routeEntry.streaming === true;
  const middleware = streaming ? deps.mppx?.sessionStream : deps.mppx?.sessionRequest;
  if (!middleware) return {};

  const tickCost = routeEntry.tickCost!;
  const unitType = routeEntry.unitType;

  try {
    const result = await middleware({
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

/**
 * Channel-only credentials are control messages that must NOT invoke the
 * route handler — settle just emits a channel-state ack on a 200 placeholder.
 *
 * Classification by `(action, routeEntry, request body presence)`:
 *  - `close` / `topUp`           → always channel-only (never carry content).
 *  - `open` / `voucher` with no body → channel-only. Bodyless opens come from
 *    `SessionManager.open({ deposit })` style explicit channel opens. Bodyless
 *    vouchers are the SSE serve loop's mid-stream top-up: the loop emits
 *    `payment-need-voucher` and the client replies with `Authorization: <cred>`
 *    and no body.
 *  - `open` / `voucher` with body → content request. The handler runs and
 *    pays one tick from the channel (mppx auto-charges at credential verify).
 *
 * `hasRequestBody` is spec-correct: per RFC 7230, a request without
 * Content-Length AND without Transfer-Encoding has no body framing. This is
 * the case for mppx's mid-stream voucher POSTs from `SessionManager.sse`,
 * which use plain `fetch(url, { method: 'POST', headers: { Authorization }})`
 * with no body. Older sniff heuristics that defaulted to "has body" when
 * `request.body !== null` misclassified those (Next.js's NextRequest exposes
 * a non-null empty ReadableStream for bodyless POSTs), causing the router to
 * invoke the handler a second time — spawning a competing `Sse.serve` loop
 * that races the original for channel headroom and fails with "reserved
 * voucher coverage is no longer available". Don't trust body-stream identity;
 * trust the framing headers.
 */
export function isChannelOnlyAction(info: MppCredentialInfo, request: Request): boolean {
  const action = info.sessionAction;
  if (!action) return false;
  if (action === 'close' || action === 'topUp') return true;
  if ((action === 'open' || action === 'voucher') && !hasRequestBody(request)) return true;
  return false;
}

/**
 * Spec-correct body-presence check, framing-only. Returns true iff the HTTP
 * request explicitly declares a body via Content-Length > 0 or
 * Transfer-Encoding. Absent both = no body, regardless of whether
 * `request.body` is null or an empty ReadableStream.
 */
function hasRequestBody(request: Request): boolean {
  const cl = request.headers.get('content-length');
  if (cl !== null) {
    const n = Number.parseInt(cl.trim(), 10);
    return Number.isFinite(n) && n > 0;
  }
  if (request.headers.get('transfer-encoding') !== null) return true;
  return false;
}
