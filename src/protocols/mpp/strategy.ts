import type { Transport } from 'mppx/server';
import { HEADERS } from '../../headers.js';
import { multiplyDecimal } from '../../pricing/format.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { MppxMiddlewareResponse } from './middleware-types.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  PaymentStrategy,
  PreflightOutcome,
  SettleArgs,
  SettleOutcome,
  StreamSettleArgs,
  VerifyArgs,
  VerifyOutcome,
} from '../types.js';
import type { RouteEntry } from '../../types.js';
import { hasMppPayment } from '../detect.js';
import { readMppCredential } from './credential.js';
import {
  buildSessionChallenge,
  isChannelOnlyAction,
  settleSessionMode,
  verifySessionMode,
  type MppSessionToken,
} from './session-mode.js';
import { settleTxMode, verifyTxMode, type TxModeToken } from './transaction-mode.js';
import { settleHashMode, verifyHashMode, type HashModeToken } from './hash-mode.js';

type AnyMppToken = TxModeToken | HashModeToken | MppSessionToken;

/** Structural stand-in for mppx's SSE `SessionController` — not exported from a public subpath since mppx 0.7. */
type SessionController = { charge(): Promise<void> };

export const mppStrategy: PaymentStrategy = {
  protocol: 'mpp',

  detects: hasMppPayment,

  preflight(request: Request, _routeEntry: RouteEntry): PreflightOutcome | null {
    const info = readMppCredential(request);
    if (!info?.sessionAction) return null;
    if (!isChannelOnlyAction(info, request)) return null;
    return { skipBody: true, skipHandler: true };
  },

  async verify(args: VerifyArgs): Promise<VerifyOutcome> {
    const info = readMppCredential(args.request);
    if (!info) return { ok: false, kind: 'invalid' };

    if (args.routeEntry.billing === 'metered') {
      if (!info.sessionAction) return { ok: false, kind: 'invalid' };
      return verifySessionMode(args, info);
    }

    if (info.sessionAction) return { ok: false, kind: 'invalid' };

    const deferTransactionSettlement =
      info.payloadType === 'transaction' &&
      args.deps.tempoClient &&
      !args.routeEntry.mppInfo?.settleBeforeHandler;

    if (deferTransactionSettlement) {
      return verifyTxMode(args, info);
    }
    return verifyHashMode(args, info);
  },

  async settle(args: SettleArgs): Promise<SettleOutcome> {
    const token = args.token as AnyMppToken;
    if (token.mode === 'session') return settleSessionMode(args);
    if (token.mode === 'transaction') return settleTxMode(args);
    return settleHashMode(args);
  },

  async settleStream(args: StreamSettleArgs): Promise<SettleOutcome> {
    const token = args.token as AnyMppToken;
    if (token.mode !== 'session' || !token.streaming) {
      return {
        ok: false,
        error: new Error('streaming requires a streaming-mode MPP session credential'),
        failMessage: 'streaming requires a streaming-mode MPP session credential',
        failStatus: 400,
      };
    }
    const sessionToken = token as MppSessionToken;
    const sseResult = sessionToken.sessionResult as Extract<
      MppxMiddlewareResponse<Transport.Sse>,
      { status: 200 }
    >;
    const { bindChannelCharge, source: handlerStream } = args;
    async function* forwardHandlerStreamWithChannelDebit(channel: SessionController) {
      bindChannelCharge(channel.charge);
      try {
        for await (const chunk of handlerStream) {
          yield typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
        }
      } finally {
        bindChannelCharge(null);
      }
    }

    const sse = sseResult.withReceipt(forwardHandlerStreamWithChannelDebit) as Response;
    sse.headers.set('Cache-Control', 'private');

    const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
      ...args.payment,
      status: 'settled',
      amount: args.payment.amount,
    };

    return { ok: true, response: sse, settledPayment };
  },

  async buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
    if (!args.deps.mppx) return {};

    const sessionsConfigured =
      args.deps.mppSessionConfig && (args.deps.mppx.sessionRequest || args.deps.mppx.sessionStream);
    if (args.routeEntry.billing === 'metered' && sessionsConfigured) {
      const tickCost = args.routeEntry.tickCost;
      const computedDeposit =
        tickCost !== undefined
          ? multiplyDecimal(tickCost, args.deps.mppSessionConfig!.depositMultiplier)
          : undefined;
      const suggestedDeposit = args.routeEntry.maxPrice ?? computedDeposit ?? args.price;
      return buildSessionChallenge({
        ...args,
        suggestedDeposit,
      });
    }

    return buildChargeChallenge(args);
  },
};

async function buildChargeChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
  if (!args.deps.mppx) return {};

  try {
    const result = await args.deps.mppx.charge({ amount: args.price })(args.request);
    if (result.status === 402) {
      const wwwAuth = result.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
      if (wwwAuth) return { headers: { [HEADERS.WWW_AUTHENTICATE]: wwwAuth } };
    }
  } catch (err) {
    args.report(
      'warn',
      `MPP challenge build failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
  return {};
}
