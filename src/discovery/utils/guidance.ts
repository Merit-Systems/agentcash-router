import type { DiscoveryConfig } from '../../types.js';

export async function resolveGuidance(discovery: DiscoveryConfig): Promise<string | undefined> {
  if (typeof discovery.guidance === 'function') return discovery.guidance();
  return discovery.guidance;
}
