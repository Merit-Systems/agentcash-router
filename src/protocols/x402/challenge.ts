import type { PaymentRequirements } from '@x402/core/types';
import type { RouteEntry, X402ResolvedAccept, X402Server } from '../../types.js';
import type { ReportFn } from '../../plugin/reporter.js';
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

type EnrichmentGroup = {
  facilitator: ResolvedX402Facilitator;
  items: PaymentRequirements[];
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

/**
 * Calls the facilitator's /accepts and maps each input requirement to its
 * enriched counterpart by `(scheme, network)` key — never by array offset, so
 * a facilitator that reorders its response cannot swap requirements.
 * Duplicate keys consume response entries in order.
 */
async function enrichGroup(
  group: EnrichmentGroup,
  resource: ChallengeResource,
): Promise<Map<PaymentRequirements, PaymentRequirements>> {
  const accepted = await enrichRequirementsWithFacilitatorAccepts(
    group.facilitator,
    resource,
    group.items,
  );
  const label = group.facilitator.url ?? group.facilitator.network;
  if (accepted.length !== group.items.length) {
    throw new Error(
      `Facilitator /accepts returned ${accepted.length} requirements for ${group.items.length} inputs on ${label}`,
    );
  }

  const pool = [...accepted];
  const replacements = new Map<PaymentRequirements, PaymentRequirements>();
  for (const item of group.items) {
    const matchIndex = pool.findIndex(
      (candidate) => candidate.scheme === item.scheme && candidate.network === item.network,
    );
    if (matchIndex === -1) {
      throw new Error(
        `Facilitator /accepts response is missing a '${item.scheme}' requirement on ${item.network} (${label})`,
      );
    }
    replacements.set(item, pool.splice(matchIndex, 1)[0]!);
  }
  return replacements;
}

async function enrichChallengeRequirements(
  requirements: PaymentRequirements[],
  resource: ChallengeResource,
  facilitatorsByNetwork?: ResolvedX402Facilitators,
  report?: ReportFn,
): Promise<PaymentRequirements[]> {
  const groups = collectEnrichmentGroups(requirements, facilitatorsByNetwork);
  if (groups.length === 0) return requirements;

  const replacements = new Map<PaymentRequirements, PaymentRequirements>();
  const dropped = new Set<PaymentRequirements>();

  await Promise.all(
    groups.map(async (group) => {
      try {
        for (const [item, enriched] of await enrichGroup(group, resource)) {
          replacements.set(item, enriched);
        }
      } catch (err) {
        const label = group.facilitator.url ?? group.facilitator.network;
        const reason = err instanceof Error ? err.message : String(err);
        report?.(
          'warn',
          `${label} /accepts failed, dropping ${group.items.length} requirement(s): ${reason}`,
        );
        for (const item of group.items) dropped.add(item);
      }
    }),
  );

  const remaining = requirements
    .filter((requirement) => !dropped.has(requirement))
    .map((requirement) => replacements.get(requirement) ?? requirement);
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

  for (const requirement of requirements) {
    if (!requiresFacilitatorEnrichment(requirement)) continue;

    const facilitator = getRequiredFacilitator(requirement, facilitatorsByNetwork);
    const existing = groups.find((group) =>
      sameResolvedX402Facilitator(group.facilitator, facilitator),
    );
    if (existing) {
      existing.items.push(requirement);
    } else {
      groups.push({ facilitator, items: [requirement] });
    }
  }

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
