import type { DiscoveryConfig } from '../types.js';
import { resolveGuidance } from './utils/guidance.js';

export function createLlmsTxtHandler(discovery: DiscoveryConfig) {
  return async (_request: Request): Promise<Response> => {
    const guidance = (await resolveGuidance(discovery)) ?? '';

    return new Response(guidance, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
}
