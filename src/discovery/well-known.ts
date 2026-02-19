import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';

export interface WellKnownOptions {
  description?: string;
  instructions?: string | (() => string | Promise<string>);
  ownershipProofs?: string[];
}

export function createWellKnownHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  options: WellKnownOptions = {},
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

    for (const [key, entry] of registry.entries()) {
      const url = `${normalizedBase}/api/${entry.path ?? key}`;
      if (entry.authMode !== 'unprotected') x402Set.add(url);
      if (entry.protocols.includes('mpp')) mppSet.add(url);
    }

    // Resolve instructions
    let instructions: string | undefined;
    if (typeof options.instructions === 'function') {
      instructions = await options.instructions();
    } else if (typeof options.instructions === 'string') {
      instructions = options.instructions;
    }

    const body: Record<string, unknown> = {
      version: 1,
      resources: Array.from(x402Set),
    };

    const mppResources = Array.from(mppSet);
    if (mppResources.length > 0) {
      body.mppResources = mppResources;
    }

    if (options.description) {
      body.description = options.description;
    }

    if (options.ownershipProofs) {
      body.ownershipProofs = options.ownershipProofs;
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
