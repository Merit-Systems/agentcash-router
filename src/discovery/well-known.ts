import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';
import type { DiscoveryConfig } from '../types.js';
import { resolveGuidance } from './utils/guidance.js';

export function createWellKnownHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  discovery: DiscoveryConfig,
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let validated = false;

  return async (_request: NextRequest): Promise<NextResponse> => {
    // Barrel validation on first call
    if (!validated && pricesKeys) {
      registry.validate(pricesKeys);
      validated = true;
    }

    // Discovery completeness: any route returning a 402 challenge needs
    // to be discoverable. Filter by authMode !== 'unprotected' rather
    // than checking specific protocols. MCP tools discover first, then
    // adapt to the specific auth mode at probe time.
    const x402Set = new Set<string>();
    const mppSet = new Set<string>();
    const methodHints = discovery.methodHints ?? 'non-default';

    for (const [, entry] of registry.entries()) {
      const url = `${normalizedBase}/api/${entry.path ?? entry.key}`;
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

    return NextResponse.json(body, {
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
