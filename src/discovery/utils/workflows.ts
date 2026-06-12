/**
 * The map-level `## Workflows` summary, shared by every surface that rides
 * the guidance channel: llms.txt AND the OpenAPI `info.x-guidance` field
 * (which is what MCP consumer pipelines actually read). well-known
 * `instructions` deliberately stays RAW guidance — nothing consumes it, so it
 * must not grow.
 *
 * The renderer dedupes isomorphic chains (identical step sequences whose URLs
 * differ only in the root step) into one representative annotated with the
 * count, and bounds output at {@link MAX_WORKFLOW_GROUPS} distinct groups —
 * without this, N near-identical chains (e.g. 100 apify actors sharing one
 * status/results tail) would render N near-identical blocks.
 */
import {
  buildWorkflowChains,
  type NextPrice,
  type WorkflowRouteStep,
  type WorkflowStep,
} from '../../pipeline/next-step.js';
import type { RouteRegistry } from '../../registry.js';
import type { DiscoveryConfig } from '../../types.js';
import { resolveGuidance } from './guidance.js';

/** Hard bound on distinct chain groups rendered into the workflows map. */
const MAX_WORKFLOW_GROUPS = 12;

/**
 * Resolve the discovery guidance and append the auto-generated `## Workflows`
 * section derived from the `.nextStep()` graph. The section is omitted when
 * the registry is absent or declares no chains; returns `undefined` when
 * there is neither guidance nor chains.
 */
export async function composeGuidanceWithWorkflows(
  discovery: DiscoveryConfig,
  registry: RouteRegistry | undefined,
  baseUrl: string,
  basePath: string,
): Promise<string | undefined> {
  const guidance = await resolveGuidance(discovery);
  if (!registry) return guidance;

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const chains = buildWorkflowChains(registry, normalizedBase, basePath);
  if (chains.length === 0) return guidance;

  const section = renderWorkflowsSection(chains, normalizedBase);
  return guidance ? `${guidance.replace(/\n+$/, '')}\n\n${section}` : section;
}

interface ChainGroup {
  representative: WorkflowStep[];
  count: number;
}

/**
 * Group isomorphic chains: identical (method, auth, price, note,
 * retryAfterSeconds) step sequences whose URLs differ only in the root step.
 * Insertion order follows the (already deterministic) chain order, so the
 * representative is the first chain of each group.
 */
function groupChains(chains: WorkflowStep[][]): ChainGroup[] {
  const groups = new Map<string, ChainGroup>();
  for (const chain of chains) {
    const signature = chainSignature(chain);
    const group = groups.get(signature);
    if (group) group.count += 1;
    else groups.set(signature, { representative: chain, count: 1 });
  }
  return [...groups.values()];
}

function chainSignature(chain: WorkflowStep[]): string {
  return JSON.stringify(
    chain.map((step, index) =>
      step.external
        ? ['external', step.note ?? null, step.retryAfterSeconds ?? null]
        : [
            step.method,
            // Root URLs (and root notes — the root note is the route's own
            // description, distinct per route by construction) may differ
            // within a group; every later URL/note must match.
            index === 0 ? null : step.url,
            step.auth,
            step.price ?? null,
            index === 0 ? null : (step.note ?? null),
            step.retryAfterSeconds ?? null,
          ],
    ),
  );
}

function renderWorkflowsSection(chains: WorkflowStep[][], baseUrl: string): string {
  const groups = groupChains(chains);
  const blocks = groups
    .slice(0, MAX_WORKFLOW_GROUPS)
    .map((group) => renderChainBlock(group, baseUrl));
  if (groups.length > MAX_WORKFLOW_GROUPS) {
    blocks.push(`…and ${groups.length - MAX_WORKFLOW_GROUPS} more workflows`);
  }
  return `## Workflows\n\n${blocks.join('\n\n')}`;
}

function renderChainBlock(group: ChainGroup, baseUrl: string): string {
  const lines = group.representative.map((step, index) => renderWorkflowLine(step, index, baseUrl));
  if (group.count > 1) {
    lines[0] += ` (and ${group.count - 1} similar routes)`;
  }
  return lines.join('\n');
}

function renderWorkflowLine(step: WorkflowStep, index: number, baseUrl: string): string {
  const note = step.note ? ` — ${step.note}` : '';
  if (step.external) {
    const retry = step.retryAfterSeconds !== undefined ? `, retry ~${step.retryAfterSeconds}s` : '';
    return `${index + 1}. (external request — resolved in the previous response's next array${retry})${note}`;
  }
  const path = baseUrl && step.url.startsWith(baseUrl) ? step.url.slice(baseUrl.length) : step.url;
  return `${index + 1}. ${step.method} ${path} (${renderAccessLabel(step)})${note}`;
}

function renderAccessLabel(step: WorkflowRouteStep): string {
  const parts: string[] = [];
  if (step.auth === 'siwx') parts.push('siwx');
  if (step.auth === 'apiKey') parts.push('api key');
  parts.push(step.price === undefined ? 'free' : renderPrice(step.price));
  if (step.retryAfterSeconds !== undefined) parts.push(`retry ~${step.retryAfterSeconds}s`);
  return parts.join(', ');
}

function renderPrice(price: NextPrice): string {
  return typeof price === 'string'
    ? `$${trimZeros(price)}`
    : `$${trimZeros(price.min)}–$${trimZeros(price.max)}`;
}

/**
 * Human-readable map rendering only — `next` entries keep the exact price
 * strings (billing-semantic). Strips trailing zeros but keeps conventional
 * money formatting: `0.054000` → `0.054`, `1.00` → `1`, `0.10` → `0.10`.
 */
function trimZeros(price: string): string {
  if (!price.includes('.')) return price;
  const trimmed = price.replace(/\.?0+$/, '') || '0';
  const fraction = trimmed.split('.')[1];
  return fraction && fraction.length === 1 ? `${trimmed}0` : trimmed;
}
