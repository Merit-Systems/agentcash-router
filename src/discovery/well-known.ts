import type { RouteRegistry } from '../registry.js';
import type { DiscoveryConfig } from '../types.js';
import { buildRouteUrl } from '../pipeline/next-step.js';
import { resolveGuidance } from './utils/guidance.js';

export function createWellKnownHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  discovery: DiscoveryConfig,
  basePath: string = 'api',
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let validated = false;

  return async (_request: Request): Promise<Response> => {
    if (!validated) {
      registry.validate(pricesKeys);
      validated = true;
    }

    const x402Set = new Set<string>();
    const mppSet = new Set<string>();
    const methodHints = discovery.methodHints ?? 'non-default';

    for (const [, entry] of registry.entries()) {
      const url = buildRouteUrl(normalizedBase, basePath, entry.path ?? entry.key);
      const resource = toDiscoveryResource(entry.method, url, methodHints);
      if (entry.authMode !== 'unprotected') x402Set.add(resource);
      if (entry.protocols.includes('mpp')) mppSet.add(resource);
    }

    const instructions = await resolveGuidance(discovery);

    const body: Record<string, unknown> = {
      version: 1,
      resources: Array.from(x402Set),
    };

    const mppResources = Array.from(mppSet);
    if (mppResources.length > 0) {
      body.mppResources = mppResources;
    }

    if (discovery.description) {
      body.description = discovery.description;
    }

    if (discovery.ownershipProofs) {
      body.ownershipProofs = discovery.ownershipProofs;
    }

    if (instructions) {
      body.instructions = instructions;
    }

    // nextStep chains deliberately do NOT appear here: the runtime response
    // body `next` array is the single chaining channel (always resolved,
    // when()-filtered, current). The map-level summary lives in llms.txt's
    // auto-generated "## Workflows" section, which rides the guidance channel.
    return Response.json(body, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  };
}

function toDiscoveryResource(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
  url: string,
  mode: NonNullable<DiscoveryConfig['methodHints']>,
): string {
  if (mode === 'off') return url;
  if (mode === 'always') return `${method} ${url}`;
  const isDefaultProbeMethod = method === 'GET' || method === 'POST';
  return isDefaultProbeMethod ? url : `${method} ${url}`;
}
