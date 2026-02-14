import type { RouteEntry } from '../types.js';

// All x402 library interactions go through these thin wrappers.
// The router never reimplements protocol logic.

export function buildX402Challenge(
  server: Record<string, Function>,
  routeEntry: RouteEntry,
  request: Request,
  price: string,
  payeeAddress: string,
  network: string,
  extensions?: Record<string, unknown>,
) {
  const { encodePaymentRequiredHeader } = require('@x402/core/http');

  const options = {
    scheme: 'exact' as const,
    network: network as `${string}:${string}`,
    price,
    payTo: payeeAddress,
  };

  const resource = {
    url: request.url,
    method: routeEntry.method,
    description: routeEntry.description,
  };

  const requirements = server.buildPaymentRequirementsFromOptions(options, {
    request,
  });
  const paymentRequired = server.createPaymentRequiredResponse(
    requirements,
    resource,
    null,
    extensions,
  );
  const encoded = encodePaymentRequiredHeader(paymentRequired);

  return { encoded, requirements };
}

export async function verifyX402Payment(
  server: Record<string, Function>,
  request: Request,
  routeEntry: RouteEntry,
  price: string,
  payeeAddress: string,
  network: string,
) {
  const { decodePaymentSignatureHeader } = require('@x402/core/http');

  const paymentHeader =
    request.headers.get('PAYMENT-SIGNATURE') ?? request.headers.get('X-PAYMENT');
  if (!paymentHeader) return null;

  const payload = decodePaymentSignatureHeader(paymentHeader);

  const options = {
    scheme: 'exact' as const,
    network: network as `${string}:${string}`,
    price,
    payTo: payeeAddress,
  };

  const requirements = server.buildPaymentRequirementsFromOptions(options, {
    request,
  });
  const matching = server.findMatchingRequirements(requirements, payload);
  const verify = await server.verifyPayment(payload, matching);

  if (!verify.isValid) {
    return { valid: false as const, payload: null, requirements: null, payer: null };
  }

  return {
    valid: true as const,
    payer: verify.payer as string,
    payload,
    requirements: matching,
  };
}

export async function settleX402Payment(
  server: Record<string, Function>,
  payload: unknown,
  requirements: unknown,
) {
  const { encodePaymentResponseHeader } = require('@x402/core/http');

  const result = await server.settlePayment(payload, requirements);
  const encoded = encodePaymentResponseHeader(result);

  return { encoded, result };
}
