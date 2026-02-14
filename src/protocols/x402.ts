import type { RouteEntry, X402Server } from '../types.js';

// All x402 library interactions go through these thin wrappers.
// The router never reimplements protocol logic.

export async function buildX402Challenge(
  server: X402Server,
  routeEntry: RouteEntry,
  request: Request,
  price: string,
  payeeAddress: string,
  network: string,
  extensions?: Record<string, unknown>,
) {
  const { encodePaymentRequiredHeader } = await import('@x402/core/http');

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

  const requirements = await server.buildPaymentRequirementsFromOptions([options], {
    request,
  });
  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    resource,
    null,
    extensions,
  );
  // SDK boundary: data produced by createPaymentRequiredResponse is consumed
  // by encodePaymentRequiredHeader. Our interface uses `unknown` to avoid
  // coupling to specific @x402/core versions — the cast is safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encoded = encodePaymentRequiredHeader(paymentRequired as any);

  return { encoded, requirements };
}

export async function verifyX402Payment(
  server: X402Server,
  request: Request,
  routeEntry: RouteEntry,
  price: string,
  payeeAddress: string,
  network: string,
) {
  const { decodePaymentSignatureHeader } = await import('@x402/core/http');

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

  const requirements = await server.buildPaymentRequirementsFromOptions([options], {
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
  server: X402Server,
  payload: unknown,
  requirements: unknown,
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  const result = await server.settlePayment(payload, requirements);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK boundary: settlePayment result → encodePaymentResponseHeader
  const encoded = encodePaymentResponseHeader(result as any);

  return { encoded, result: result as { transaction?: string } };
}
