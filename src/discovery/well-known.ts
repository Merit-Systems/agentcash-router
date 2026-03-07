import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';
import type { DiscoveryConfig } from '../types.js';
import { resolveGuidance } from './utils/guidance.js';
import { WellKnownDocSchema } from '@agentcash/discovery/schemas';
import type { WellKnownDoc } from '@agentcash/discovery/schemas';

export function createWellKnownHandler(
  registry: RouteRegistry,
  baseUrl: string,
  discovery: DiscoveryConfig,
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  return async (_request: NextRequest): Promise<NextResponse> => {
    if (registry.size === 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[agentcash/router] wellKnown() called but no routes are registered. ' +
          'You must import all route handler files into this file.',
      );
    }

    // Discovery completeness: any route returning a 402 challenge needs
    // to be discoverable. Filter by authMode !== 'unprotected' rather
    // than checking specific protocols. MCP tools discover first, then
    // adapt to the specific auth mode at probe time.
    const x402Set = new Set<string>();
    const mppSet = new Set<string>();
    const methodHints = discovery.methodHints ?? 'non-default';

    for (const [key, entry] of registry.entries()) {
      const url = `${normalizedBase}/api/${entry.path ?? key}`;
      const resource = toDiscoveryResource(entry.method, url, methodHints);
      if (entry.authMode !== 'unprotected') x402Set.add(resource);
      if (entry.protocols.includes('mpp')) mppSet.add(resource);
    }

    const instructions = await resolveGuidance(discovery);

    const mppResources = Array.from(mppSet);
    const body = {
      version: 1,
      resources: Array.from(x402Set),
      ...(mppResources.length > 0 ? { mppResources } : {}),
      ...(discovery.description ? { description: discovery.description } : {}),
      ...(discovery.ownershipProofs ? { ownershipProofs: discovery.ownershipProofs } : {}),
      ...(instructions ? { instructions } : {}),
    } satisfies WellKnownDoc;

    const check = WellKnownDocSchema.safeParse(body);
    if (!check.success) {
      throw new Error(
        `[agentcash-router] Well-known document failed discovery schema validation:\n${JSON.stringify(check.error.issues, null, 2)}`,
      );
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
