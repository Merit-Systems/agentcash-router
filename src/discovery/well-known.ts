import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';

export interface WellKnownOptions {
  instructions?: string | (() => string | Promise<string>);
  ownershipProofs?: string[];
}

export function createWellKnownHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  options: WellKnownOptions = {},
) {
  let validated = false;

  return async (_request: NextRequest): Promise<NextResponse> => {
    // Barrel validation on first call
    if (!validated && pricesKeys) {
      registry.validate(pricesKeys);
      validated = true;
    }

    // Build x402 resources
    const x402Resources: string[] = [];
    const mppResources: string[] = [];

    for (const [key, entry] of registry.entries()) {
      const url = `${baseUrl}/api/${entry.path ?? key}`;
      if (entry.protocols.includes('x402')) x402Resources.push(url);
      if (entry.protocols.includes('mpp')) mppResources.push(url);
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
      resources: x402Resources,
    };

    if (mppResources.length > 0) {
      body.mppResources = mppResources;
    }

    if (options.ownershipProofs) {
      body.ownershipProofs = options.ownershipProofs;
    }

    if (instructions) {
      body.instructions = instructions;
    }

    return NextResponse.json(body);
  };
}
