import type { HandlerPaymentContext } from '../../types.js';
import { HEADERS } from '../../headers.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  PaymentStrategy,
  SettleArgs,
  SettleOutcome,
  VerifyArgs,
  VerifyOutcome,
} from '../types.js';
import { resolveX402Accepts } from './accepts.js';
import { buildX402Challenge } from './challenge.js';
import { settleX402Payment } from './settle.js';
import { verifyX402Payment } from './verify.js';

interface X402Token {
  payload: unknown;
  requirements: import('@x402/core/types').PaymentRequirements;
}

export const x402Strategy: PaymentStrategy = {
  protocol: 'x402',

  detects(request: Request): boolean {
    return Boolean(
      request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
      request.headers.get(HEADERS.X402_PAYMENT_LEGACY),
    );
  },

  async verify(args: VerifyArgs): Promise<VerifyOutcome> {
    const { request, body, price, routeEntry, deps } = args;

    if (!deps.x402Server) {
      const reason = deps.x402InitError
        ? `x402 facilitator initialization failed: ${deps.x402InitError}`
        : 'x402 server not initialized — ensure @x402/core, @x402/evm, and @coinbase/x402 are installed';
      console.error(`[router] ${routeEntry.key}: ${reason}`);
      return { ok: false, kind: 'config', message: reason };
    }

    const accepts = await resolveX402Accepts(
      request,
      routeEntry,
      deps.x402Accepts,
      deps.payeeAddress,
      body,
    );
    const verifyResult = await verifyX402Payment({
      server: deps.x402Server,
      request,
      price,
      accepts,
    });
    if (!verifyResult?.valid) return { ok: false, kind: 'invalid' };

    const wallet = normalizeWalletAddress(verifyResult.payer);
    const matchedNetwork = getRequirementNetwork(verifyResult.requirements, deps.network);
    const matchedRecipient = getRequirementRecipient(verifyResult.requirements);

    const payment: HandlerPaymentContext = {
      protocol: 'x402',
      status: 'verified',
      payer: wallet,
      amount: price,
      network: matchedNetwork,
      ...(matchedRecipient ? { recipient: matchedRecipient } : {}),
    };

    return {
      ok: true,
      wallet,
      payment,
      token: {
        payload: verifyResult.payload,
        requirements: verifyResult.requirements,
      } satisfies X402Token,
    };
  },

  async settle(args: SettleArgs): Promise<SettleOutcome> {
    const { response, payment, token, deps, routeEntry, effectiveAmount } = args;
    const x402Token = token as X402Token;

    try {
      // Variable-priced upto routes thread the post-handler total here as a
      // settlement override; the Permit2Proxy contract enforces `actual ≤
      // permitted.amount` (the cap the user signed) on chain. Static routes
      // settle for the requirements amount the client already verified
      // against, so we don't push an override.
      const settlementAmountOverride = routeEntry.dynamicPrice
        ? { amount: effectiveAmount }
        : undefined;
      const settle = await settleX402Payment(
        deps.x402Server!,
        x402Token.payload,
        x402Token.requirements,
        settlementAmountOverride,
      );
      if (!settle.result?.success) {
        const reason = settle.result?.errorReason || 'x402 settlement returned success=false';
        const error = new Error(reason) as Error & { errorReason?: string };
        error.errorReason = reason;
        throw error;
      }

      response.headers.set(HEADERS.X402_PAYMENT_RESPONSE, settle.encoded);
      response.headers.set('Cache-Control', 'private');

      const transaction = String(settle.result?.transaction ?? '');
      const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
        ...payment,
        status: 'settled',
        amount: effectiveAmount,
        ...(transaction ? { transaction } : {}),
      };

      return { ok: true, response, settledPayment };
    } catch (err) {
      const errObj = err as {
        message?: string;
        errorReason?: string;
        response?: { status?: number; data?: unknown; body?: unknown };
      };
      console.error('Settlement failed', {
        message: err instanceof Error ? err.message : String(err),
        route: args.routeEntry.key,
        network: payment.network,
        errorReason: errObj.errorReason,
        facilitatorStatus: errObj.response?.status,
        facilitatorBody: errObj.response?.data ?? errObj.response?.body,
      });
      return { ok: false, error: err, failMessage: 'Settlement failed' };
    }
  },

  async buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution> {
    const { request, routeEntry, body, price, extensions, deps } = args;

    if (!deps.x402Server) return {};

    const accepts = await resolveX402Accepts(
      request,
      routeEntry,
      deps.x402Accepts,
      deps.payeeAddress,
      body,
    );

    const { encoded } = await buildX402Challenge({
      server: deps.x402Server,
      routeEntry,
      request,
      price,
      accepts,
      facilitatorsByNetwork: deps.x402FacilitatorsByNetwork,
      extensions,
    });

    return { headers: { [HEADERS.X402_PAYMENT_REQUIRED]: encoded } };
  },
};

function getRequirementNetwork(requirements: unknown, fallback: string): string {
  const network = (requirements as { network?: unknown } | null)?.network;
  return typeof network === 'string' ? network : fallback;
}

function getRequirementRecipient(requirements: unknown): string | undefined {
  const payTo = (requirements as { payTo?: unknown } | null)?.payTo;
  return typeof payTo === 'string' ? payTo : undefined;
}
