import type { PaymentRequirements } from '@x402/core/types';
import { PERMIT2_ADDRESS } from '@x402/evm';
import type { HandlerPaymentContext } from '../../types.js';
import type { ReportFn } from '../../plugin/reporter.js';
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
import { verifyX402Payment, type VerifyPaymentFailure } from './verify.js';

function formatVerifyFailureMessage(failure: VerifyPaymentFailure): string {
  if (failure.reason === 'permit2_allowance_required') {
    const wallet = failure.payer ?? '<the payer wallet>';
    const asset = failure.accepted?.asset ?? '<the asset>';
    const amount = failure.accepted?.amount ?? '<the required amount>';
    const network = failure.accepted?.network ?? '<the payment network>';
    return [
      `Payment rejected: In order for Upto to charge, the wallet ${wallet} MUST approve Permit2 to spend ${asset} on ${network}.`,
      `Required call (one-time, on-chain): ${asset}.approve(${PERMIT2_ADDRESS}, MAX_UINT256) from ${wallet}.`,
      `Permit2 contract address: ${PERMIT2_ADDRESS}.`,
      `Minimum allowance for this request: ${amount} (smallest units of ${asset}); use MAX_UINT256 to avoid re-approving on every future call.`,
      `Alternative without an on-chain transaction: the merchant can adopt the EIP-2612 gas-sponsoring extension (https://docs.x402.org/extensions/eip2612-gas-sponsoring).`,
    ].join(' ');
  }
  if (failure.message) {
    return `Payment rejected (${failure.reason}): ${failure.message}`;
  }
  return `Payment rejected: ${failure.reason}`;
}

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

  verify: (args: VerifyArgs) => verifyX402(args),
  settle: (args: SettleArgs) => settleX402(args),
  buildChallenge: (args: ChallengeArgs) => buildX402ChallengeContribution(args),
};

async function verifyX402(args: VerifyArgs): Promise<VerifyOutcome> {
  const { request, body, price, routeEntry, deps, report } = args;

  if (!deps.x402Server) {
    const reason = deps.x402InitError
      ? `x402 facilitator initialization failed: ${deps.x402InitError}`
      : 'x402 server not initialized — ensure @x402/core, @x402/evm, and @coinbase/x402 are installed';
    report('error', reason);
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
    report,
  });
  if (!verifyResult?.valid) {
    const failure = verifyResult?.failure;
    if (failure) {
      return {
        ok: false,
        kind: 'invalid',
        failure: {
          reason: failure.reason,
          message: formatVerifyFailureMessage(failure),
        },
      };
    }
    return { ok: false, kind: 'invalid' };
  }

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
  const { response, payment, token, deps, routeEntry, billedAmount, report } = args;
  const { payload, requirements } = token as X402Token;

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
    reportSettleFailure(report, err, payment.network);
    return { ok: false, error: err, failMessage: 'Settlement failed' };
  }
}

async function buildX402ChallengeContribution(args: ChallengeArgs): Promise<ChallengeContribution> {
  const { request, routeEntry, body, price, extensions, deps, report } = args;

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
    report,
  });

  return { headers: { [HEADERS.X402_PAYMENT_REQUIRED]: encoded } };
}

interface FacilitatorErrorShape {
  errorReason?: string;
  response?: { status?: number; data?: unknown; body?: unknown };
}

function reportSettleFailure(report: ReportFn, err: unknown, network: string): void {
  const facilitator = (err ?? {}) as FacilitatorErrorShape;
  const meta = {
    error: err instanceof Error ? err.message : String(err),
    network,
    errorReason: facilitator.errorReason,
    facilitatorStatus: facilitator.response?.status,
    facilitatorBody: facilitator.response?.data ?? facilitator.response?.body,
  };
  report('error', 'Settlement failed', meta);
}
