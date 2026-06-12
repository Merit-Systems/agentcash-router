import type { RouteRegistry } from '../registry.js';
import type { DiscoveryConfig } from '../types.js';
import { buildWorkflowChains, type NextPrice, type WorkflowStep } from '../pipeline/next-step.js';
import { resolveGuidance } from './utils/guidance.js';

export function createLlmsTxtHandler(
  discovery: DiscoveryConfig,
  registry?: RouteRegistry,
  baseUrl?: string,
  basePath: string = 'api',
) {
  return async (_request: Request): Promise<Response> => {
    const guidance = (await resolveGuidance(discovery)) ?? '';

    let body = guidance;
    if (registry) {
      const chains = buildWorkflowChains(registry, baseUrl?.replace(/\/+$/, '') ?? '', basePath);
      if (chains.length > 0) {
        const section = renderWorkflowsSection(chains, baseUrl?.replace(/\/+$/, '') ?? '');
        body = body ? `${body.replace(/\n+$/, '')}\n\n${section}\n` : `${section}\n`;
      }
    }

    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
}

function renderWorkflowsSection(chains: WorkflowStep[][], baseUrl: string): string {
  const blocks = chains.map((chain) =>
    chain.map((step, index) => renderWorkflowLine(step, index, baseUrl)).join('\n'),
  );
  return `## Workflows\n\n${blocks.join('\n\n')}`;
}

function renderWorkflowLine(step: WorkflowStep, index: number, baseUrl: string): string {
  const path = baseUrl && step.url.startsWith(baseUrl) ? step.url.slice(baseUrl.length) : step.url;
  const label = renderAccessLabel(step);
  const note = step.note ? ` — ${step.note}` : '';
  return `${index + 1}. ${step.method} ${path} (${label})${note}`;
}

function renderAccessLabel(step: WorkflowStep): string {
  const parts: string[] = [];
  if (step.auth === 'siwx') parts.push('siwx');
  if (step.auth === 'apiKey') parts.push('api key');
  parts.push(step.price === undefined ? 'free' : renderPrice(step.price));
  return parts.join(', ');
}

function renderPrice(price: NextPrice): string {
  return typeof price === 'string' ? `$${price}` : `$${price.min}–$${price.max}`;
}
