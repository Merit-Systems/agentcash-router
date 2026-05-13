import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { VerifyError } from '@x402/core/types';
import type { X402ResolvedAccept, X402Server } from '../../types.js';
import type { ReportFn } from '../../plugin/reporter.js';
import { HEADERS } from '../../headers.js';
import { buildExpectedRequirements } from './requirements.js';

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
  const payload = await readPaymentPayload(request);
  if (!payload) return null;
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

function findVerifiableRequirements(
  server: X402Server,
  requirements: PaymentRequirements[],
  payload: PaymentPayload,
): PaymentRequirements | null {
  const strictMatch = server.findMatchingRequirements(requirements, payload);
  if (strictMatch) {
    return payload.x402Version === 2 ? payload.accepted : strictMatch;
  }

  if (payload.x402Version !== 2) {
    return null;
  }

  const stableMatch = requirements.find((requirement) =>
    matchesStableFields(requirement, payload.accepted),
  );
  return stableMatch ? payload.accepted : null;
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

async function readPaymentPayload(request: Request): Promise<PaymentPayload | null> {
  const paymentHeader =
    request.headers.get(HEADERS.X402_PAYMENT_SIGNATURE) ??
    request.headers.get(HEADERS.X402_PAYMENT_LEGACY);
  if (!paymentHeader) return null;

  const { decodePaymentSignatureHeader } = await import('@x402/core/http');
  return decodePaymentSignatureHeader(paymentHeader);
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
