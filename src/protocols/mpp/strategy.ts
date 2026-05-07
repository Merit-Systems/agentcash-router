import type { NextResponse } from 'next/server';
import type { Session } from 'mppx/tempo';
import { AUTH_SCHEME, HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  PaymentStrategy,
  SettleArgs,
  SettleOutcome,
  StreamSettleArgs,
  VerifyArgs,
  VerifyOutcome,
} from '../types.js';
import { readMppCredential } from './credential.js';
import {
  buildSessionChallenge,
  settleSessionMode,
  verifySessionMode,
  type MppSessionToken,
} from './session-mode.js';
import { settleTxMode, verifyTxMode, type TxModeToken } from './transaction-mode.js';
import { settleHashMode, verifyHashMode, type HashModeToken } from './hash-mode.js';

type AnyMppToken = TxModeToken | HashModeToken | MppSessionToken;

export const mppStrategy: PaymentStrategy = {
  protocol: 'mpp',

  detects(request: Request): boolean {
    const auth = request.headers.get(HEADERS.AUTHORIZATION);
    return Boolean(auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT));
  },

  async verify(args: VerifyArgs): Promise<VerifyOutcome> {
    const info = readMppCredential(args.request);
    if (!info) return { ok: false, kind: 'invalid' };

    const isSessionCredential = Boolean(info.sessionAction);
    const requiresSession = args.routeEntry.dynamicPrice ?? false;

    if (isSessionCredential) {
      // Sessions on fixed-price routes aren't wired today; for now they're
      // accepted only on dynamic routes (the 402 advertises sessions there).
      if (!requiresSession) return { ok: false, kind: 'invalid' };
      return verifySessionMode(args, info);
    }

    // Dynamic routes can't accept charge credentials — they commit the client
    // to a fixed amount before the handler runs.
    if (requiresSession) return { ok: false, kind: 'invalid' };

    if (info.payloadType === 'transaction' && args.deps.tempoClient) {
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

  /**
   * Streaming settle: piggy-back the handler's async iterable onto an SSE
   * channel. We bridge the handler's `charge()` callback to mppx's per-tick
   * channel debit so each `charge()` reserves voucher headroom in real time;
   * yields stay pure data flow. Only valid on session credentials.
   */
  async settleStream(args: StreamSettleArgs): Promise<SettleOutcome> {
    const token = args.token as AnyMppToken;
    if (token.mode !== 'session') {
      return {
        ok: false,
        error: new Error('streaming requires an MPP session credential'),
        failMessage: 'streaming requires an MPP session credential',
        failStatus: 400,
      };
    }
    const sessionToken = token as MppSessionToken;
    const { bindChannelCharge, source: handlerStream } = args;

    const forwardHandlerStreamWithChannelDebit = (channel: Session.Sse.SessionController) =>
      (async function* () {
        bindChannelCharge(channel.charge);
        try {
          for await (const chunk of handlerStream) {
            yield typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          }
        } finally {
          bindChannelCharge(null);
        }
      })();

    const sse = sessionToken.sessionResult.withReceipt(
      forwardHandlerStreamWithChannelDebit,
    ) as NextResponse;
    sse.headers.set('Cache-Control', 'private');

    // The cumulative amount isn't known until the stream ends; carry the cap.
    const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
      ...args.payment,
      status: 'settled',
      amount: args.payment.amount,
    };

    return { ok: true, response: sse, settledPayment };
  },

  async buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
    if (!args.deps.mppx) return {};

    if (args.routeEntry.dynamicPrice && args.deps.mppx.session && args.deps.mppSessionConfig) {
      return buildSessionChallenge({
        ...args,
        suggestedDeposit: args.routeEntry.maxPrice ?? args.price,
      });
    }

    try {
      const result = await args.deps.mppx.charge({ amount: args.price })(args.request);
      if (result.status === 402) {
        const wwwAuth = result.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
        if (wwwAuth) return { headers: { [HEADERS.WWW_AUTHENTICATE]: wwwAuth } };
      }
    } catch (err) {
      console.warn(
        `[router] MPP challenge build failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    return {};
  },
};
