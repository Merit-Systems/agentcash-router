import type { PaymentRequirements } from '@x402/core/types';
import type { HandlerPaymentContext } from '../../types.js';
import type { ReportFn } from '../../plugin/reporter.js';
import { HEADERS } from '../../headers.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { readX402PaymentHeader } from '../detect.js';
import type {
  ChallengeArgs,
  ChallengeContribution,
  PaymentStrategy,
  SettleArgs,
  SettleOutcome,
  VerifyArgs,
  VerifyOutcome,
} from '../types.js';
import { resolveX402Accepts, selectRouteAccepts } from './accepts.js';
import { buildX402Challenge } from './challenge.js';
import { settleX402Payment } from './settle.js';
import { verifyX402Payment, type VerifyPaymentFailure } from './verify.js';

/**
 * Canonical Permit2 contract address. Permit2 is deployed via deterministic
 * CREATE2 to the same address on every EVM chain, so the value is a fixed
 * well-known constant. Inlined (rather than imported from `@x402/evm`) so
 * deployments that never serve x402 routes don't load that module at startup;
 * `tests/x402-permit2.test.ts` asserts this stays equal to `@x402/evm`'s
 * exported `PERMIT2_ADDRESS`.
 */
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const SETTLE_RETRY_DELAYS_MS = [500, 1000] as const;

/**
 * Settlement `errorReason` codes that are deterministic: re-submitting the
 * same signed payment can never succeed, so retrying only burns the retry
 * budget. Kept deliberately conservative (exact-match on documented codes
 * from the @x402 scheme implementations) — unknown or free-text reasons stay
 * retryable, since the transient class (facilitator hiccups) is the common
 * one.
 */
const NON_RETRYABLE_SETTLE_REASONS: ReadonlySet<string> = new Set([
  'insufficient_funds',
  'invalid_exact_evm_insufficient_balance',
  'invalid_exact_evm_signature',
  'invalid_exact_evm_nonce_already_used',
  // `valid_before` means the authorization window has expired — it can only
  // get worse with time. (`valid_after` is intentionally absent: a not-yet-
  // valid authorization can become valid during the retry window.)
  'invalid_exact_evm_payload_authorization_valid_before',
  'duplicate_settlement',
]);

/**
 * Reasons implying this payment has already been settled — possibly by an
 * earlier attempt of ours whose response we never observed.
 */
const ALREADY_SETTLED_REASONS: ReadonlySet<string> = new Set([
  'invalid_exact_evm_nonce_already_used',
  'duplicate_settlement',
]);

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
    return Boolean(readX402PaymentHeader(request));
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
      : 'x402 server not initialized';
    report('error', reason);
    return { ok: false, kind: 'config', message: reason };
  }

  const accepts = await resolveX402Accepts(
    request,
    routeEntry,
    selectRouteAccepts(deps.x402Accepts, routeEntry),
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
  const { response, payment, token, routeEntry, billedAmount, report } = args;
  const { payload, requirements } = token as X402Token;

  const override = routeEntry.billing === 'exact' ? undefined : { amount: billedAmount };

  try {
    const settle = await settleWithRetry(args, payload, requirements, override);

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

type SettleAttempt = Awaited<ReturnType<typeof settleX402Payment>>;

/**
 * Attempts settlement up to `1 + SETTLE_RETRY_DELAYS_MS.length` times.
 *
 * Two transient failure shapes are retried:
 * - the settle call THREW (timeout / network error) — the settlement state is
 *   unknown; the facilitator may or may not have settled. Retrying is safe
 *   because settlement is idempotent per payment nonce: a duplicate submit
 *   fails deterministically instead of double-charging.
 * - the settle call resolved with `success: false` and a reason that is not
 *   in the known-deterministic set.
 *
 * Deterministic reasons (insufficient funds, invalid signature, nonce reuse)
 * fail immediately without burning the retry budget.
 */
async function settleWithRetry(
  args: SettleArgs,
  payload: unknown,
  requirements: PaymentRequirements,
  override: { amount?: string } | undefined,
): Promise<SettleAttempt> {
  const { deps, report } = args;
  const maxAttempts = SETTLE_RETRY_DELAYS_MS.length + 1;
  let sawThrownAttempt = false;
  let lastFailure: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SETTLE_RETRY_DELAYS_MS[attempt - 1]);
      });
    }

    let settle: SettleAttempt;
    try {
      settle = await settleX402Payment(deps.x402Server!, payload, requirements, override);
    } catch (err) {
      sawThrownAttempt = true;
      lastFailure = err;
      if (attempt < maxAttempts - 1) {
        report('warn', 'Retrying x402 settlement', {
          attempt: attempt + 1,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    if (settle.result?.success) return settle;

    const errorReason = settle.result?.errorReason;
    lastFailure = Object.assign(
      new Error(errorReason ?? 'x402 settlement returned success=false'),
      { errorReason },
    );

    if (errorReason !== undefined && NON_RETRYABLE_SETTLE_REASONS.has(errorReason)) {
      // POST-THROW AMBIGUITY: if an earlier attempt THREW (we never saw the
      // facilitator's response) and a retry now reports an already-settled
      // style reason, the thrown attempt may in fact have settled on-chain.
      // We deliberately do NOT invent success — we have no settle response
      // (no tx hash / PAYMENT-RESPONSE header) to hand the client — so the
      // request still fails, but operators are alerted to reconcile the
      // payment against on-chain state before assuming the payer was never
      // charged.
      if (sawThrownAttempt && ALREADY_SETTLED_REASONS.has(errorReason)) {
        report(
          'critical',
          `x402 settlement ambiguous: an earlier attempt threw before a response was observed, and a retry failed with '${errorReason}' — the thrown attempt may have settled on-chain (possible double-settle ambiguity); reconcile against on-chain state`,
          { errorReason },
        );
      }
      throw lastFailure;
    }

    if (attempt < maxAttempts - 1) {
      report('warn', 'Retrying x402 settlement', {
        attempt: attempt + 1,
        errorReason,
      });
    }
  }

  throw lastFailure;
}

async function buildX402ChallengeContribution(args: ChallengeArgs): Promise<ChallengeContribution> {
  const { request, routeEntry, body, price, extensions, deps, report } = args;

  if (!deps.x402Server) return {};

  const accepts = await resolveX402Accepts(
    request,
    routeEntry,
    selectRouteAccepts(deps.x402Accepts, routeEntry),
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
