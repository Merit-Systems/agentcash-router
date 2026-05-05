import { AUTH_SCHEME, HEADERS } from '../../headers.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  PaymentStrategy,
  SettleArgs,
  SettleOutcome,
  VerifyArgs,
  VerifyOutcome,
} from '../types.js';
import { readMppCredential } from './credential.js';
import { settleTxMode, verifyTxMode, type TxModeToken } from './transaction-mode.js';
import { settleHashMode, verifyHashMode, type HashModeToken } from './hash-mode.js';

export const mppStrategy: PaymentStrategy = {
  protocol: 'mpp',

  detects(request: Request): boolean {
    const auth = request.headers.get(HEADERS.AUTHORIZATION);
    return Boolean(auth && auth.startsWith(AUTH_SCHEME.MPP_PAYMENT));
  },

  async verify(args: VerifyArgs): Promise<VerifyOutcome> {
    const info = readMppCredential(args.request);
    if (!info) return { ok: false, kind: 'invalid' };

    // tx-payload mode requires tempoClient; otherwise fall back to hash-mode.
    if (info.payloadType === 'transaction' && args.deps.tempoClient) {
      return verifyTxMode(args, info);
    }
    return verifyHashMode(args, info);
  },

  async settle(args: SettleArgs): Promise<SettleOutcome> {
    const token = args.token as TxModeToken | HashModeToken;
    if (token.mode === 'transaction') return settleTxMode(args);
    return settleHashMode(args);
  },

  async buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
    if (!args.deps.mppx) return {};
    try {
      const result = await args.deps.mppx.charge({ amount: args.price })(args.request);
      if (result.status === 402) {
        const wwwAuth = result.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
        if (wwwAuth) return { headers: { [HEADERS.WWW_AUTHENTICATE]: wwwAuth } };
      }
    } catch (err) {
      // Surface as alert via the caller — for now log and skip.
      console.warn(
        `[router] MPP challenge build failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    return {};
  },
};
