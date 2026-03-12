import type { PaymentPayload, PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { RouteEntry, X402ResolvedAccept, X402Server } from '../types.js';
import { getFacilitatorForRequirement } from '../x402-facilitators.js';
import type { ResolvedX402Facilitator } from '../x402-facilitators.js';
import { buildEvmExactOptions } from './evm.js';
import {
  buildSolanaExactOptions,
  enrichRequirementsWithFacilitatorAccepts,
  hasSolanaAccepts,
  isSolanaRequirement,
} from './solana.js';

// All x402 library interactions go through these thin wrappers.
// The router never reimplements protocol logic.

export async function buildX402Challenge(
  server: X402Server,
  routeEntry: RouteEntry,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
  facilitatorsByNetwork?: Record<string, ResolvedX402Facilitator>,
  extensions?: Record<string, unknown>,
) {
  const { encodePaymentRequiredHeader } = await import('@x402/core/http');

  const resource = {
    url: request.url,
    method: routeEntry.method,
    description: routeEntry.description,
    mimeType: 'application/json',
  };

  const requirements = await buildChallengeRequirements(
    server,
    request,
    price,
    accepts,
    resource,
    facilitatorsByNetwork,
  );
  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    resource,
    undefined,
    extensions,
  );
  const encoded = encodePaymentRequiredHeader(paymentRequired);

  return { encoded, requirements };
}

export async function verifyX402Payment(
  server: X402Server,
  request: Request,
  routeEntry: RouteEntry,
  price: string,
  accepts: X402ResolvedAccept[],
) {
  const { decodePaymentSignatureHeader } = await import('@x402/core/http');

  const paymentHeader =
    request.headers.get('PAYMENT-SIGNATURE') ?? request.headers.get('X-PAYMENT');
  if (!paymentHeader) return null;

  const payload = decodePaymentSignatureHeader(paymentHeader);
  const requirements = await buildExpectedRequirements(server, request, price, accepts);
  const matching = findVerifiableRequirements(server, requirements, payload);
  if (!matching) {
    return { valid: false as const, payload: null, requirements: null, payer: null };
  }

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

async function buildExpectedRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const customAccepts = accepts.filter((accept) => accept.scheme !== 'exact');
  const exactOptions = [
    ...buildEvmExactOptions(accepts, price),
    ...buildSolanaExactOptions(accepts, price),
  ];

  const exactRequirements =
    exactOptions.length > 0
      ? await server.buildPaymentRequirementsFromOptions(exactOptions, { request })
      : [];

  const customRequirements = customAccepts.map(buildCustomRequirement.bind(null, price));
  return [...exactRequirements, ...customRequirements];
}

async function buildChallengeRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
  resource: { url: string; method: string; description?: string; mimeType: string },
  facilitatorsByNetwork?: Record<string, ResolvedX402Facilitator>,
): Promise<PaymentRequirements[]> {
  const requirements = await buildExpectedRequirements(server, request, price, accepts);
  const needsFacilitatorEnrichment =
    accepts.some((accept) => accept.scheme !== 'exact') || hasSolanaAccepts(accepts);
  if (!needsFacilitatorEnrichment) {
    return requirements;
  }

  const groupedRequirements = new Map<
    ResolvedX402Facilitator,
    Array<{ index: number; requirement: PaymentRequirements }>
  >();

  requirements.forEach((requirement, index) => {
    if (!requiresFacilitatorEnrichment(requirement)) return;

    const facilitator = getFacilitatorForRequirement(facilitatorsByNetwork, requirement);
    if (!facilitator) {
      throw new Error(
        `Missing x402 facilitator for ${requirement.scheme} requirement on ${requirement.network}`,
      );
    }

    const existingGroup = groupedRequirements.get(facilitator);
    if (existingGroup) {
      existingGroup.push({ index, requirement });
      return;
    }

    groupedRequirements.set(facilitator, [{ index, requirement }]);
  });

  if (groupedRequirements.size === 0) {
    return requirements;
  }

  const enrichedRequirements = [...requirements];
  await Promise.all(
    [...groupedRequirements.entries()].map(async ([facilitator, group]) => {
      const enriched = await enrichRequirementsWithFacilitatorAccepts(
        facilitator,
        resource,
        group.map(({ requirement }) => requirement),
      );
      if (enriched.length !== group.length) {
        throw new Error(
          `Facilitator /accepts returned ${enriched.length} requirements for ${group.length} inputs on ${facilitator.url ?? facilitator.network}`,
        );
      }

      enriched.forEach((requirement, offset) => {
        const index = group[offset]?.index;
        if (index === undefined) return;
        enrichedRequirements[index] = requirement;
      });
    }),
  );

  return enrichedRequirements;
}

function requiresFacilitatorEnrichment(requirement: PaymentRequirements): boolean {
  return requirement.scheme !== 'exact' || isSolanaRequirement(requirement);
}

function buildCustomRequirement(price: string, accept: X402ResolvedAccept): PaymentRequirements {
  if (!accept.asset) {
    throw new Error(
      `Custom x402 accept '${accept.scheme}' on '${accept.network}' is missing asset`,
    );
  }

  return {
    scheme: accept.scheme,
    network: accept.network as `${string}:${string}`,
    amount: decimalToAtomicUnits(price, accept.decimals ?? 6),
    asset: accept.asset,
    payTo: accept.payTo,
    maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 300,
    extra: accept.extra ?? {},
  };
}

function decimalToAtomicUnits(amount: string, decimals: number): string {
  const match = /^(?<whole>\d+)(?:\.(?<fraction>\d+))?$/.exec(amount);
  if (!match?.groups) {
    throw new Error(`Invalid decimal amount '${amount}'`);
  }

  const whole = match.groups.whole;
  const fraction = match.groups.fraction ?? '';
  if (fraction.length > decimals) {
    throw new Error(`Amount '${amount}' exceeds ${decimals} decimal places`);
  }

  const normalized = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
  return normalized === '' ? '0' : normalized;
}

export async function settleX402Payment(
  server: X402Server,
  payload: unknown,
  requirements: PaymentRequirements,
) {
  const { encodePaymentResponseHeader } = await import('@x402/core/http');

  const result = await server.settlePayment(payload, requirements);
  const encoded = encodePaymentResponseHeader(result);

  return { encoded, result: result as SettleResponse & { transaction?: string } };
}
