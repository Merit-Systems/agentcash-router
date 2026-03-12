import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { DiscoveryConfig } from '../types.js';
import { resolveGuidance } from './utils/guidance.js';

export function createLlmsTxtHandler(discovery: DiscoveryConfig) {
  return async (_request: NextRequest): Promise<NextResponse> => {
    const guidance = (await resolveGuidance(discovery)) ?? '';

    return new NextResponse(guidance, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
}
