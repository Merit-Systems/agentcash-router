import type { RouteRegistry } from '../registry.js';
import type { RouteEntry, DiscoveryConfig } from '../types.js';
import { TEMPO_USDC_ADDRESS } from '../constants.js';
import { HEADERS } from '../headers.js';
import {
  buildNextStepDescriptor,
  tierPriceExtrema,
  type NextStepDescriptor,
} from '../pipeline/next-step.js';
import { resolveGuidance } from './utils/guidance.js';

export function createOpenAPIHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  discovery: DiscoveryConfig,
  basePath: string = 'api',
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const prefix = basePath ? `/${basePath}` : '';
  let cached: unknown = null;
  let validated = false;

  return async (_request: Request): Promise<Response> => {
    if (cached) return Response.json(cached);

    if (!validated) {
      registry.validate(pricesKeys);
      validated = true;
    }

    const { createDocument } = await import('zod-openapi');

    const paths: Record<string, Record<string, unknown>> = {};
    const tagSet = new Set<string>();
    let requiresSiwxScheme = false;
    let requiresApiKeyScheme = false;

    for (const [, entry] of registry.entries()) {
      const apiPath = `${prefix}/${entry.path ?? entry.key}`;
      const method = entry.method.toLowerCase();
      const tag = deriveTag(entry.key);
      tagSet.add(tag);
      const nextSteps = describeNextSteps(entry, registry, normalizedBase, basePath);
      const built = buildOperation(entry.key, entry, tag, nextSteps);
      if (built.requiresSiwxScheme) requiresSiwxScheme = true;
      if (built.requiresApiKeyScheme) requiresApiKeyScheme = true;

      paths[apiPath] = { ...paths[apiPath], [method]: built.operation };
    }

    const securitySchemes: Record<string, unknown> = {};
    if (requiresSiwxScheme) {
      securitySchemes.siwx = {
        type: 'apiKey',
        in: 'header',
        name: HEADERS.SIWX,
      };
    }
    if (requiresApiKeyScheme) {
      securitySchemes.apiKey = {
        type: 'apiKey',
        in: 'header',
        name: HEADERS.API_KEY,
      };
    }

    const discoveryMetadata: Record<string, unknown> = {};
    if (discovery.ownershipProofs && discovery.ownershipProofs.length > 0) {
      discoveryMetadata.ownershipProofs = discovery.ownershipProofs;
    }

    const guidance = await resolveGuidance(discovery);

    const openApiDocument: Record<string, unknown> = {
      openapi: '3.1.0',
      info: {
        title: discovery.title,
        description: discovery.description,
        version: discovery.version,
        ...(guidance !== undefined && { 'x-guidance': guidance }),
        guidance,
        ...(discovery.contact && { contact: discovery.contact }),
      },
      servers: [{ url: (discovery.serverUrl ?? normalizedBase).replace(/\/+$/, '') }],
      tags: Array.from(tagSet)
        .sort()
        .map((name) => ({ name })),
      ...(Object.keys(securitySchemes).length > 0
        ? {
            components: {
              securitySchemes,
            },
          }
        : {}),
      ...(Object.keys(discoveryMetadata).length > 0
        ? {
            'x-discovery': discoveryMetadata,
          }
        : {}),
      paths: paths as never,
    };

    cached = createDocument(openApiDocument as never);

    return Response.json(cached);
  };
}

function deriveTag(routeKey: string): string {
  return routeKey
    .split('/')[0]
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

interface NamedNextStep {
  descriptor: NextStepDescriptor;
  note?: string;
}

function describeNextSteps(
  entry: RouteEntry,
  registry: RouteRegistry,
  baseUrl: string,
  basePath: string,
): NamedNextStep[] {
  return (entry.nextSteps ?? []).flatMap((step) => {
    const target = registry.get(step.route);
    if (!target) return []; // registry.validate() throws before generation; defensive only
    return [
      {
        descriptor: buildNextStepDescriptor(step, target, baseUrl, basePath),
        note: step.note,
      },
    ];
  });
}

function buildOperation(
  routeKey: string,
  entry: RouteEntry,
  tag: string,
  nextSteps: NamedNextStep[],
): {
  operation: Record<string, unknown>;
  requiresSiwxScheme: boolean;
  requiresApiKeyScheme: boolean;
} {
  const protocols =
    entry.protocols.length > 0
      ? entry.protocols.map((p) => toProtocolObject(p, entry.mppInfo))
      : undefined;
  const paymentRequired = Boolean(entry.pricing) || entry.authMode === 'paid';
  const requiresSiwxScheme = entry.authMode === 'siwx' || Boolean(entry.siwxEnabled);
  const requiresApiKeyScheme = Boolean(entry.apiKeyResolver) && entry.authMode !== 'siwx';
  const pricingInfo = buildPricingInfo(entry);

  const operation: Record<string, unknown> = {
    operationId: toOperationId(routeKey),
    summary: entry.description ?? routeKey,
    tags: [tag],
    responses: {
      '200': {
        description: 'Successful response',
        ...(entry.outputSchema && {
          content: {
            'application/json': { schema: entry.outputSchema },
          },
        }),
        ...(nextSteps.length > 0 && { links: buildResponseLinks(nextSteps) }),
      },
      ...((paymentRequired || requiresSiwxScheme) && {
        '402': {
          description: requiresSiwxScheme ? 'Authentication Required' : 'Payment Required',
        },
      }),
      ...(requiresApiKeyScheme && {
        '401': {
          description: 'Unauthorized',
        },
      }),
    },
  };

  if (nextSteps.length > 0) {
    operation['x-next'] = nextSteps.map(({ descriptor }) => descriptor);
  }

  if (paymentRequired && (pricingInfo || protocols)) {
    operation['x-payment-info'] = {
      ...(pricingInfo ?? {}),
      ...(protocols && { protocols }),
    };
  }

  if (requiresSiwxScheme) {
    operation.security = [{ siwx: [] }];
  } else if (requiresApiKeyScheme) {
    operation.security = [{ apiKey: [] }];
  } else if (entry.authMode === 'unprotected') {
    operation.security = [];
  }

  if (entry.bodySchema) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': { schema: entry.bodySchema },
      },
    };
  }

  if (entry.querySchema) {
    operation.requestParams = {
      query: entry.querySchema,
    };
  }

  return {
    operation,
    requiresSiwxScheme,
    requiresApiKeyScheme,
  };
}

function toOperationId(routeKey: string): string {
  return routeKey.replace(/\//g, '_');
}

function buildResponseLinks(nextSteps: NamedNextStep[]): Record<string, unknown> {
  const links: Record<string, unknown> = {};
  for (const { descriptor, note } of nextSteps) {
    const operationId = toOperationId(descriptor.route);
    links[operationId] = {
      operationId,
      ...(note !== undefined && { description: note }),
    };
  }
  return links;
}

function toProtocolObject(
  protocol: string,
  mppInfo?: { method?: string; intent?: string; currency?: string },
): Record<string, unknown> {
  if (protocol === 'mpp') {
    return {
      mpp: {
        method: mppInfo?.method ?? 'tempo',
        intent: mppInfo?.intent ?? 'charge',
        currency: mppInfo?.currency ?? TEMPO_USDC_ADDRESS,
      },
    };
  }
  return { [protocol]: {} };
}

function buildPricingInfo(entry: RouteEntry): Record<string, unknown> | undefined {
  if (!entry.pricing) return undefined;

  if (typeof entry.pricing === 'string') {
    return {
      price: { mode: 'fixed', currency: 'USD', amount: entry.pricing },
    };
  }

  if (typeof entry.pricing === 'function') {
    return {
      price: {
        mode: 'dynamic',
        currency: 'USD',
        min: entry.minPrice ?? '0',
        max: entry.maxPrice ?? '0',
      },
    };
  }

  if ('tiers' in entry.pricing) {
    const extrema = tierPriceExtrema(Object.values(entry.pricing.tiers).map((tier) => tier.price));

    if (extrema) {
      if (extrema.min === extrema.max) {
        return {
          price: { mode: 'fixed', currency: 'USD', amount: extrema.min },
        };
      }
      return {
        price: { mode: 'dynamic', currency: 'USD', min: extrema.min, max: extrema.max },
      };
    }

    return {
      price: {
        mode: 'dynamic',
        currency: 'USD',
        min: '0',
        max: entry.maxPrice ?? '0',
      },
    };
  }

  return undefined;
}
