import type { NextResponse } from 'next/server';
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

    // Session credentials (open/voucher/topUp/close) — long-lived payment
    // channels. Required for dynamic-priced routes; charge credentials commit
    // to a fixed amount before the handler runs and can't honor a post-hoc
    // total. We accept session credentials on fixed-price routes too, but
    // those paths aren't fully wired (mppx's auto-charge requires non-SSE
    // session mode and we register with sse:true) — for now, gate on dynamic.
    if (info.sessionAction) {
      if (!args.routeEntry.dynamicPrice) {
        return { ok: false, kind: 'invalid' };
      }
      return verifySessionMode(args, info);
    }

    // Charge credentials on dynamic-priced routes can't honor a post-hoc
    // amount. The 402 challenge advertises sessions; misbehaving clients that
    // bypass it land here.
    if (args.routeEntry.dynamicPrice) {
      return { ok: false, kind: 'invalid' };
    }

    // tx-payload mode requires tempoClient; otherwise fall back to hash-mode.
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
   * Streaming settle path: the handler returned an AsyncIterable, so we feed
   * it directly to mppx's session SSE serve loop. Each yielded value triggers
   * one tickCost charge from the channel before the chunk is emitted; the
   * client signs new vouchers transparently as the channel runs short.
   *
   * Only valid on session credentials. Rejects charge credentials and
   * non-session tokens.
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

    // Coerce yielded values to strings — mppx's withReceipt expects
    // `AsyncIterable<string>` for SSE auto-charge mode. JSON-stringify objects
    // so handlers can yield typed values without manual conversion.
    const stringSource = (async function* () {
      for await (const chunk of args.source) {
        yield typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
      }
    })();

    const sse = sessionToken.sessionResult.withReceipt(stringSource) as NextResponse;
    sse.headers.set('Cache-Control', 'private');

    const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
      ...args.payment,
      status: 'settled',
      // Streaming amount is determined per-tick by mppx; we don't have the
      // final cumulative until the stream ends. Carry the cap for now.
      amount: args.payment.amount,
    };

    return { ok: true, response: sse, settledPayment };
  },

  async buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
    if (!args.deps.mppx) return {};

    // Dynamic-priced routes advertise sessions: the client opens a channel
    // with `suggestedDeposit` (= maxPrice) and signs vouchers per request.
    // mppx's session middleware constructs the WWW-Authenticate header with
    // intent="session" and the channel parameters.
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
