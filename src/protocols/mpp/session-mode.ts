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
  VerifyFailure,
  VerifySuccess,
} from '../types.js';
import type { MppxMiddlewareResponse } from '../../pipeline/context/types.js';
import type { MppCredentialInfo } from './credential.js';

export interface MppSessionToken {
  mode: 'session';
  streaming: boolean;
  sessionResult:
    | Extract<MppxMiddlewareResponse<Transport.Sse>, { status: 200 }>
    | Extract<MppxMiddlewareResponse<Transport.Http>, { status: 200 }>;
  info: MppCredentialInfo;
  tickCost: string;
}

export async function verifySessionMode(
  args: VerifyArgs,
  info: MppCredentialInfo,
): Promise<
  | VerifySuccess
  | { ok: false; kind: 'invalid'; failure?: VerifyFailure }
  | { ok: false; kind: 'config'; message: string }
> {
  const { request, deps, price, routeEntry } = args;

  if (!deps.mppx?.sessionRequest || !deps.mppx?.sessionStream || !deps.mppSessionConfig) {
    return {
      ok: false,
      kind: 'config',
      message: 'MPP sessions not configured on this server (set RouterConfig.mpp.session)',
    };
  }

  const tickCost = routeEntry.tickCost!;
  const unitType = routeEntry.unitType;
  const streaming = routeEntry.streaming === true;
  const middleware = streaming ? deps.mppx.sessionStream : deps.mppx.sessionRequest;

  const middlewareRequest = isChannelOnlyAction(info, request)
    ? new Request(request.url, { method: request.method, headers: request.headers })
    : request;

  let result: MppxMiddlewareResponse<Transport.Sse> | MppxMiddlewareResponse<Transport.Http>;
  try {
    result = await middleware({
      amount: tickCost,
      unitType,
      suggestedDeposit: price,
      ...(streaming ? { meta: { streaming: 'true' } } : {}),
    })(middlewareRequest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      kind: 'config',
      message: `MPP session verify failed: ${message}`,
    };
  }

  if (result.status === 402) {
    const failure = await readMppxProblemDetails(result.challenge);
    return { ok: false, kind: 'invalid', failure };
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

export async function settleSessionMode(args: SettleArgs): Promise<SettleOutcome> {
  const { request, response, payment, token, billedAmount } = args;
  const sessionToken = token as MppSessionToken;

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
      ...(streaming ? { meta: { streaming: 'true' } } : {}),
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

export function isChannelOnlyAction(info: MppCredentialInfo, request: Request): boolean {
  const action = info.sessionAction;
  if (!action) return false;
  if (action === 'close' || action === 'topUp') return true;
  if ((action === 'open' || action === 'voucher') && !hasRequestBody(request)) return true;
  return false;
}

async function readMppxProblemDetails(challenge: Response): Promise<VerifyFailure> {
  let body: string;
  try {
    body = await challenge.clone().text();
  } catch {
    return { reason: 'mpp_session_invalid' };
  }
  if (!body) return { reason: 'mpp_session_invalid' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { reason: 'mpp_session_invalid', message: body.slice(0, 500) };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { reason: 'mpp_session_invalid' };
  }
  const details = parsed as { type?: unknown; title?: unknown; detail?: unknown };
  const typeUri = typeof details.type === 'string' ? details.type : undefined;
  const slug = typeUri ? typeUri.split('/').pop() : undefined;
  const reason = slug ? slug.replace(/-/g, '_') : 'mpp_session_invalid';
  const message =
    typeof details.detail === 'string' && details.detail.length > 0
      ? details.detail
      : typeof details.title === 'string'
        ? details.title
        : undefined;
  return message ? { reason, message } : { reason };
}

function hasRequestBody(request: Request): boolean {
  const cl = request.headers.get('content-length');
  if (cl !== null) {
    const n = Number.parseInt(cl.trim(), 10);
    return Number.isFinite(n) && n > 0;
  }
  if (request.headers.get('transfer-encoding') !== null) return true;
  return false;
}
