import type { NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import type { Session } from 'mppx/tempo';
import { AUTH_SCHEME, HEADERS } from '../../headers.js';
import type { HandlerPaymentContext } from '../../types.js';
import type { MppxMiddlewareResponse } from '../../pipeline/context/types.js';
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

export const mppStrategy: PaymentStrategy = {
  protocol: 'mpp',

  detects(request: Request): boolean {
    const auth = request.headers.get(HEADERS.AUTHORIZATION);
    return Boolean(auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT));
  },

  preflight(request: Request, _routeEntry: RouteEntry): PreflightOutcome | null {
    const info = readMppCredential(request);
    if (!info?.sessionAction) return null;
    if (!isChannelOnlyAction(info, request)) return null;
    // Channel-management credentials (close/topUp, plus bodyless open/voucher
    // POSTs — including the SSE loop's mid-stream voucher) are control
    // messages: settle's withReceipt() emits the channel-state ack directly
    // with no handler invocation.
    return { skipBody: true, skipHandler: true };
  },

  async verify(args: VerifyArgs): Promise<VerifyOutcome> {
    const info = readMppCredential(args.request);
    if (!info) return { ok: false, kind: 'invalid' };

    if (args.routeEntry.dynamicPrice) {
      // Dynamic routes only accept session credentials — charge credentials
      // commit the client to a fixed amount before the handler runs.
      if (!info.sessionAction) return { ok: false, kind: 'invalid' };
      return verifySessionMode(args, info);
    }

    // Static routes can't accept session credentials — sessions are only
    // advertised on dynamic routes' 402 challenges.
    if (info.sessionAction) return { ok: false, kind: 'invalid' };

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
   * yields stay pure data flow. Only valid on streaming session credentials
   * (verifySessionMode used the SSE-transport mppx instance).
   */
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
    // verifySessionMode produced this from the SSE-transport mppx instance —
    // narrow to the SSE-flavored `withReceipt` so the generator-factory
    // overload is in scope.
    const sseResult = sessionToken.sessionResult as Extract<
      MppxMiddlewareResponse<Transport.Sse>,
      { status: 200 }
    >;
    const { bindChannelCharge, source: handlerStream } = args;
    async function* forwardHandlerStreamWithChannelDebit(channel: Session.Sse.SessionController) {
      bindChannelCharge(channel.charge);
      try {
        for await (const chunk of handlerStream) {
          yield typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
        }
      } finally {
        bindChannelCharge(null);
      }
    }

    const sse = sseResult.withReceipt(forwardHandlerStreamWithChannelDebit) as NextResponse;
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

    // Dynamic routes prefer session challenges when sessions are configured;
    // static routes always use charge. Both fall back to charge.
    const sessionsConfigured =
      args.deps.mppSessionConfig && (args.deps.mppx.sessionRequest || args.deps.mppx.sessionStream);
    if (args.routeEntry.dynamicPrice && sessionsConfigured) {
      const tickCost = args.routeEntry.tickCost;
      // Prefer the route's explicit cap, fall back to tickCost × depositMultiplier
      // (default 10), final fallback to the current price.
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

/**
 * Decimal-string × integer multiplication. We avoid Number here so deposits
 * like `0.0005 × 10 = 0.005` come out exact instead of `0.004999999...`.
 * Both inputs are constrained: tickCost is a positive decimal validated at
 * builder time, multiplier is a positive integer from config.
 */
function multiplyDecimal(decimal: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) return decimal;
  const [whole, fraction = ''] = decimal.split('.');
  const scaled = (BigInt(whole + fraction) * BigInt(factor)).toString();
  const decimals = fraction.length;
  if (decimals === 0) return scaled;
  const padded = scaled.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

async function buildChargeChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
  if (!args.deps.mppx) return {};

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
}
