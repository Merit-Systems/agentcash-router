import type { PaymentRequirements } from '@x402/core/types';
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
  requirements: PaymentRequirements;
}

export const x402Strategy: PaymentStrategy = {
  protocol: 'x402',

  detects(request: Request): boolean {
    return Boolean(
      request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
      request.headers.get(HEADERS.X402_PAYMENT_LEGACY),
    );
  },

  // x402 verify and buildChallenge are mode-agnostic — the upto vs exact
  // distinction lives in settle (dynamicAmountOverride) and in the requirements
  // scheme picked by buildX402Challenge, both keyed off `routeEntry.dynamicPrice`.
  verify: (args: VerifyArgs) => verifyX402(args),
  settle: (args: SettleArgs) => settleX402(args),
  buildChallenge: (args: ChallengeArgs) => buildX402ChallengeContribution(args),
};

async function verifyX402(args: VerifyArgs): Promise<VerifyOutcome> {
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
  const { network, payTo } = verifyResult.requirements;

  const payment: HandlerPaymentContext = {
    protocol: 'x402',
    status: 'verified',
    payer: wallet,
    amount: price,
    network,
    ...(payTo ? { recipient: payTo } : {}),
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
}

async function settleX402(args: SettleArgs): Promise<SettleOutcome> {
  const { response, payment, token, deps, routeEntry, billedAmount } = args;
  const { payload, requirements } = token as X402Token;

  // Dynamic routes use upto and override the on-chain amount with the
  // post-handler total (Permit2Proxy enforces `actual ≤ permitted.amount`).
  // Static routes settle for the verified requirements amount.
  const override = routeEntry.dynamicPrice ? { amount: billedAmount } : undefined;

  try {
    const settle = await settleX402Payment(deps.x402Server!, payload, requirements, override);
    if (!settle.result?.success) {
      throw Object.assign(
        new Error(settle.result?.errorReason ?? 'x402 settlement returned success=false'),
        { errorReason: settle.result?.errorReason },
      );
    }

    response.headers.set(HEADERS.X402_PAYMENT_RESPONSE, settle.encoded);
    response.headers.set('Cache-Control', 'private');

    const transaction = String(settle.result.transaction ?? '');
    const settledPayment: HandlerPaymentContext & { status: 'settled' } = {
      ...payment,
      status: 'settled',
      amount: billedAmount,
      ...(transaction ? { transaction } : {}),
    };

    return { ok: true, response, settledPayment };
  } catch (err) {
    logSettleFailure(err, routeEntry.key, payment.network);
    return { ok: false, error: err, failMessage: 'Settlement failed' };
  }
}

async function buildX402ChallengeContribution(args: ChallengeArgs): Promise<ChallengeContribution> {
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
}

interface FacilitatorErrorShape {
  errorReason?: string;
  response?: { status?: number; data?: unknown; body?: unknown };
}

function logSettleFailure(err: unknown, route: string, network: string): void {
  const facilitator = (err ?? {}) as FacilitatorErrorShape;
  console.error('Settlement failed', {
    message: err instanceof Error ? err.message : String(err),
    route,
    network,
    errorReason: facilitator.errorReason,
    facilitatorStatus: facilitator.response?.status,
    facilitatorBody: facilitator.response?.data ?? facilitator.response?.body,
  });
}
