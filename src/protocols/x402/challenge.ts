import type { PaymentRequirements } from '@x402/core/types';
import type { RouteEntry, X402ResolvedAccept, X402Server } from '../../types.js';
import type { ReportFn } from '../../pipeline/alert.js';
import {
  getFacilitatorForRequirement,
  sameResolvedX402Facilitator,
  type ResolvedX402Facilitator,
  type ResolvedX402Facilitators,
} from './facilitators.js';
import {
  enrichRequirementsWithFacilitatorAccepts,
  hasSolanaAccepts,
  isSolanaRequirement,
} from './solana.js';
import { buildExpectedRequirements } from './requirements.js';

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

interface BuildChallengeOptions {
  server: X402Server;
  routeEntry: RouteEntry;
  request: Request;
  price: string;
  accepts: X402ResolvedAccept[];
  facilitatorsByNetwork?: ResolvedX402Facilitators;
  extensions?: Record<string, unknown>;
  report?: ReportFn;
}

export async function buildX402Challenge(opts: BuildChallengeOptions) {
  const { server, routeEntry, request, price, accepts, facilitatorsByNetwork, extensions, report } =
    opts;
  const { encodePaymentRequiredHeader } = await import('@x402/core/http');
  const resource = buildChallengeResource(request, routeEntry);
  const requirements = await buildChallengeRequirements(
    server,
    request,
    price,
    accepts,
    resource,
    facilitatorsByNetwork,
    report,
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

async function buildChallengeRequirements(
  server: X402Server,
  request: Request,
  price: string,
  accepts: X402ResolvedAccept[],
  resource: ChallengeResource,
  facilitatorsByNetwork?: ResolvedX402Facilitators,
  report?: ReportFn,
): Promise<PaymentRequirements[]> {
  const requirements = await buildExpectedRequirements(server, request, price, accepts, report);
  if (!needsFacilitatorEnrichment(accepts)) return requirements;
  return enrichChallengeRequirements(requirements, resource, facilitatorsByNetwork, report);
}

function needsFacilitatorEnrichment(accepts: X402ResolvedAccept[]): boolean {
  return hasSolanaAccepts(accepts);
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
  report?: ReportFn,
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
        report?.(
          'warn',
          `${label} /accepts failed, dropping ${group.items.length} requirement(s): ${reason}`,
        );
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
    throw new Error(
      'All facilitator enrichments failed; no payment requirements remain for challenge',
    );
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
  return isSolanaRequirement(requirement);
}

function buildChallengeResource(request: Request, routeEntry: RouteEntry): ChallengeResource {
  return {
    url: request.url,
    method: routeEntry.method,
    description: routeEntry.description,
    mimeType: 'application/json',
  };
}
