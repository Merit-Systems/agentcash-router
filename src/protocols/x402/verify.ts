import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { VerifyError } from '@x402/core/types';
import type { X402ResolvedAccept, X402Server } from '../../types.js';
import type { ReportFn } from '../../plugin/reporter.js';
import { readX402PaymentHeader } from '../detect.js';
import { buildExpectedRequirements } from './requirements.js';
import { isSolanaRequirement } from './solana.js';

interface VerifyPaymentOptions {
  server: X402Server;
  request: Request;
  price: string;
  accepts: X402ResolvedAccept[];
  report?: ReportFn;
}

export interface VerifyPaymentFailure {
  reason: string;
  message?: string;
  payer?: string;
  accepted?: PaymentRequirements;
}

export async function verifyX402Payment(opts: VerifyPaymentOptions) {
  const { server, request, price, accepts, report } = opts;
  const payment = await readPaymentPayload(request);
  if (payment.kind === 'none') return null;
  if (payment.kind === 'malformed') {
    return invalidPaymentVerification({
      reason: 'malformed_payment_header',
      message: `X-PAYMENT header could not be decoded: ${payment.message}`,
    });
  }
  const payload = payment.payload;
  const requirements = await buildExpectedRequirements(server, request, price, accepts, report);
  const matching = findVerifiableRequirements(server, requirements, payload);
  const accepted = payload.x402Version === 2 ? payload.accepted : undefined;
  if (!matching) {
    return invalidPaymentVerification({
      reason: 'requirements_mismatch',
      message: 'Signed payment requirements did not match any server-built requirement',
      ...(accepted ? { accepted } : {}),
    });
  }

  let verify: Awaited<ReturnType<X402Server['verifyPayment']>>;
  try {
    verify = await server.verifyPayment(payload, matching);
  } catch (err: unknown) {
    if (err instanceof VerifyError && err.statusCode >= 400 && err.statusCode < 500) {
      return invalidPaymentVerification({
        reason: err.invalidReason ?? 'verify_error',
        ...(err.invalidMessage ? { message: err.invalidMessage } : {}),
        ...(err.payer ? { payer: err.payer } : {}),
        ...(accepted ? { accepted } : {}),
      });
    }
    throw err;
  }
  if (!verify.isValid) {
    return invalidPaymentVerification({
      reason: verify.invalidReason ?? 'unknown',
      ...(verify.invalidMessage ? { message: verify.invalidMessage } : {}),
      ...(verify.payer ? { payer: verify.payer } : {}),
      ...(accepted ? { accepted } : {}),
    });
  }
  if (!verify.payer) {
    throw new Error('x402 verification succeeded without a payer address');
  }

  return {
    valid: true as const,
    payer: verify.payer,
    payload,
    requirements: matching,
  };
}

/**
 * Picks the requirement that verification and settlement run against.
 *
 * Trust rationale: the v2 payload's `accepted` field is a CLIENT-CONTROLLED
 * copy of the requirement it claims the server offered. Settling against it
 * verbatim would let a client tamper with any field the match doesn't pin
 * down. We therefore always prefer the SERVER-BUILT requirement, and merge in
 * only the fields that legitimately exist solely in `accepted`: facilitator
 * enrichment (see `mergeFacilitatorEnrichedFields`).
 */
function findVerifiableRequirements(
  server: X402Server,
  requirements: PaymentRequirements[],
  payload: PaymentPayload,
): PaymentRequirements | null {
  const strictMatch = server.findMatchingRequirements(requirements, payload);
  if (payload.x402Version !== 2) {
    return strictMatch ?? null;
  }

  const serverMatch =
    strictMatch ??
    requirements.find((requirement) => matchesStableFields(requirement, payload.accepted));
  return serverMatch ? mergeFacilitatorEnrichedFields(serverMatch, payload.accepted) : null;
}

/**
 * Solana-network requirements are enriched at challenge time through the
 * facilitator's `/accepts` endpoint (see `challenge.ts`), which stamps fields
 * like `extra.feePayer` and `extra.recentBlockhash` onto the requirement. The
 * server-side rebuild at verify time does NOT repeat that enrichment, so the
 * client's `accepted.extra` is the only place those fields survive — carry
 * them over. This is safe because the facilitator independently validates
 * `extra.feePayer` against its own signer set during verification; every
 * settlement-critical field (scheme, network, payTo, asset, amount,
 * maxTimeoutSeconds) still comes from the server-built requirement.
 */
function mergeFacilitatorEnrichedFields(
  serverRequirement: PaymentRequirements,
  accepted: PaymentRequirements,
): PaymentRequirements {
  if (!isSolanaRequirement(serverRequirement)) return serverRequirement;
  if (!accepted.extra || typeof accepted.extra !== 'object') return serverRequirement;
  return {
    ...serverRequirement,
    extra: { ...(serverRequirement.extra ?? {}), ...accepted.extra },
  };
}

function matchesStableFields(
  requirement: PaymentRequirements,
  accepted: PaymentRequirements,
): boolean {
  return (
    requirement.scheme === accepted.scheme &&
    requirement.network === accepted.network &&
    requirement.payTo === accepted.payTo &&
    requirement.asset === accepted.asset &&
    requirement.amount === accepted.amount &&
    requirement.maxTimeoutSeconds === accepted.maxTimeoutSeconds
  );
}

type ReadPaymentResult =
  | { kind: 'none' }
  | { kind: 'malformed'; message: string }
  | { kind: 'ok'; payload: PaymentPayload };

async function readPaymentPayload(request: Request): Promise<ReadPaymentResult> {
  const paymentHeader = readX402PaymentHeader(request);
  if (!paymentHeader) return { kind: 'none' };

  const { decodePaymentSignatureHeader } = await import('@x402/core/http');
  try {
    return { kind: 'ok', payload: decodePaymentSignatureHeader(paymentHeader) };
  } catch (err) {
    return {
      kind: 'malformed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function invalidPaymentVerification(failure?: VerifyPaymentFailure) {
  return {
    valid: false as const,
    payload: null,
    requirements: null,
    payer: null,
    ...(failure ? { failure } : {}),
  };
}
