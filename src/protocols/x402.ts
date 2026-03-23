import type { PaymentPayload, PaymentRequirements, SettleResponse } from '@x402/core/types';
import type { RouteEntry, X402ResolvedAccept, X402Server } from '../types.js';
import { getFacilitatorForRequirement, sameResolvedX402Facilitator } from '../x402-facilitators.js';
import type { ResolvedX402Facilitator, ResolvedX402Facilitators } from '../x402-facilitators.js';
import { buildEvmExactOptions } from './evm.js';
import {
  buildSolanaExactOptions,
  enrichRequirementsWithFacilitatorAccepts,
  hasSolanaAccepts,
  isSolanaRequirement,
} from './solana.js';

// All x402 library interactions go through these thin wrappers.
// The router never reimplements protocol logic.

interface BuildChallengeOptions {
  server: X402Server;
  routeEntry: RouteEntry;
  request: Request;
  price: string;
  accepts: X402ResolvedAccept[];
  facilitatorsByNetwork?: ResolvedX402Facilitators;
  extensions?: Record<string, unknown>;
}

interface VerifyPaymentOptions {
  server: X402Server;
  request: Request;
  price: string;
  accepts: X402ResolvedAccept[];
}

type ChallengeResource = {
  url: string;
  method: string;
  description?: string;
  mimeType: string;
};

type IndexedRequirement = {
  index: number;
  requirement: PaymentRequirements;
};

type EnrichmentGroup = {
  facilitator: ResolvedX402Facilitator;
  items: IndexedRequirement[];
};

export async function buildX402Challenge(opts: BuildChallengeOptions) {
  const { server, routeEntry, request, price, accepts, facilitatorsByNetwork, extensions } = opts;
  const { encodePaymentRequiredHeader } = await import('@x402/core/http');
  const resource = buildChallengeResource(request, routeEntry);
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

export async function verifyX402Payment(opts: VerifyPaymentOptions) {
  const { server, request, price, accepts } = opts;
  const payload = await readPaymentPayload(request);
  if (!payload) return null;
  const requirements = await buildExpectedRequirements(server, request, price, accepts);
  const matching = findVerifiableRequirements(server, requirements, payload);
  if (!matching) {
    return invalidPaymentVerification();
  }

  let verify: { isValid: boolean; payer?: unknown };
  try {
    verify = await server.verifyPayment(payload, matching);
  } catch (err: unknown) {
    // VerifyError from @x402/core with 4xx statusCode (e.g. insufficient_funds)
    // is a client payment issue → 402 challenge, not 500. 5xx/unknown re-throws.
    const sc = (err as { statusCode?: number }).statusCode;
    if (sc && sc >= 400 && sc < 500) return invalidPaymentVerification();
    throw err;
  }
  if (!verify.isValid) return invalidPaymentVerification();

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
  const exactRequirements = await buildExactRequirements(server, request, price, accepts);
  const customRequirements = buildCustomRequirements(price, accepts);
  return [...exactRequirements, ...customRequirements];
}

async function buildExactRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
): Promise<PaymentRequirements[]> {
  const exactGroups = [
    buildEvmExactOptions(accepts, price),
    buildSolanaExactOptions(accepts, price),
  ].filter((options) => options.length > 0);

  if (exactGroups.length === 0) return [];

  const requirements: PaymentRequirements[] = [];
  const failures: Error[] = [];

  for (const options of exactGroups) {
    try {
      requirements.push(
        ...(await server.buildPaymentRequirementsFromOptions(options, { request })),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failures.push(err);
      if (exactGroups.length === 1) {
        throw err;
      }
      console.warn(
        `[router] Failed to build x402 exact requirements for ${options[0]?.network}: ${err.message}`,
      );
    }
  }

  if (requirements.length > 0) {
    return requirements;
  }

  throw failures[0] ?? new Error('Failed to build x402 exact requirements');
}

function buildCustomRequirements(
  price: string,
  accepts: X402ResolvedAccept[],
): PaymentRequirements[] {
  return accepts
    .filter((accept) => accept.scheme !== 'exact')
    .map((accept) => buildCustomRequirement(price, accept));
}

async function buildChallengeRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
  resource: ChallengeResource,
  facilitatorsByNetwork?: ResolvedX402Facilitators,
): Promise<PaymentRequirements[]> {
  const requirements = await buildExpectedRequirements(server, request, price, accepts);
  if (!needsFacilitatorEnrichment(accepts)) return requirements;
  return enrichChallengeRequirements(requirements, resource, facilitatorsByNetwork);
}

function needsFacilitatorEnrichment(accepts: X402ResolvedAccept[]): boolean {
  return accepts.some((accept) => accept.scheme !== 'exact') || hasSolanaAccepts(accepts);
}

async function enrichGroup(
  group: EnrichmentGroup,
  resource: ChallengeResource,
): Promise<PaymentRequirements[]> {
  const accepted = await enrichRequirementsWithFacilitatorAccepts(
    group.facilitator,
    resource,
    group.items.map(({ requirement }) => requirement),
  );
  if (accepted.length !== group.items.length) {
    throw new Error(
      `Facilitator /accepts returned ${accepted.length} requirements for ${group.items.length} inputs on ${group.facilitator.url ?? group.facilitator.network}`,
    );
  }
  return accepted;
}

async function enrichChallengeRequirements(
  requirements: PaymentRequirements[],
  resource: ChallengeResource,
  facilitatorsByNetwork?: ResolvedX402Facilitators,
): Promise<PaymentRequirements[]> {
  const groups = collectEnrichmentGroups(requirements, facilitatorsByNetwork);
  if (groups.length === 0) return requirements;

  type EnrichmentResult =
    | { success: true; group: EnrichmentGroup; accepted: PaymentRequirements[] }
    | { success: false; group: EnrichmentGroup };

  const results = await Promise.all(
    groups.map(async (group): Promise<EnrichmentResult> => {
      try {
        return { success: true, group, accepted: await enrichGroup(group, resource) };
      } catch (err) {
        const label = group.facilitator.url ?? group.facilitator.network;
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[router] ${label} /accepts failed, dropping ${group.items.length} requirement(s): ${reason}`);
        return { success: false, group };
      }
    }),
  );

  const enriched = [...requirements];
  results
    .filter((r): r is Extract<EnrichmentResult, { success: true }> => r.success)
    .forEach(({ group, accepted }) => {
      accepted.forEach((req, offset) => {
        const index = group.items[offset]?.index;
        if (index !== undefined) enriched[index] = req;
      });
    });

  const failedIndices = new Set(
    results
      .filter((r): r is Extract<EnrichmentResult, { success: false }> => !r.success)
      .flatMap(({ group }) => group.items.map(({ index }) => index)),
  );

  const remaining = enriched.filter((_, i) => !failedIndices.has(i));
  if (remaining.length === 0) {
    throw new Error('All facilitator enrichments failed; no payment requirements remain for challenge');
  }

  return remaining;
}

function collectEnrichmentGroups(
  requirements: PaymentRequirements[],
  facilitatorsByNetwork?: ResolvedX402Facilitators,
): EnrichmentGroup[] {
  const groups: EnrichmentGroup[] = [];

  requirements.forEach((requirement, index) => {
    if (!requiresFacilitatorEnrichment(requirement)) return;

    const facilitator = getRequiredFacilitator(requirement, facilitatorsByNetwork);
    const existing = groups.find((group) =>
      sameResolvedX402Facilitator(group.facilitator, facilitator),
    );
    if (existing) {
      existing.items.push({ index, requirement });
      return;
    }

    groups.push({
      facilitator,
      items: [{ index, requirement }],
    });
  });

  return groups;
}

function getRequiredFacilitator(
  requirement: PaymentRequirements,
  facilitatorsByNetwork?: ResolvedX402Facilitators,
): ResolvedX402Facilitator {
  const facilitator = getFacilitatorForRequirement(facilitatorsByNetwork, requirement);
  if (!facilitator) {
    throw new Error(
      `Missing x402 facilitator for ${requirement.scheme} requirement on ${requirement.network}`,
    );
  }
  return facilitator;
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

function buildChallengeResource(request: Request, routeEntry: RouteEntry): ChallengeResource {
  return {
    url: request.url,
    method: routeEntry.method,
    description: routeEntry.description,
    mimeType: 'application/json',
  };
}

async function readPaymentPayload(request: Request): Promise<PaymentPayload | null> {
  const paymentHeader =
    request.headers.get('PAYMENT-SIGNATURE') ?? request.headers.get('X-PAYMENT');
  if (!paymentHeader) return null;

  const { decodePaymentSignatureHeader } = await import('@x402/core/http');
  return decodePaymentSignatureHeader(paymentHeader);
}

function invalidPaymentVerification() {
  return { valid: false as const, payload: null, requirements: null, payer: null };
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
