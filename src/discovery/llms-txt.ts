import type { RouteRegistry } from '../registry.js';
import type { DiscoveryConfig } from '../types.js';
import { composeGuidanceWithWorkflows } from './utils/workflows.js';

export function createLlmsTxtHandler(
  discovery: DiscoveryConfig,
  registry?: RouteRegistry,
  baseUrl?: string,
  basePath: string = 'api',
) {
  return async (_request: Request): Promise<Response> => {
    const body =
      (await composeGuidanceWithWorkflows(discovery, registry, baseUrl ?? '', basePath)) ?? '';

    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
}
