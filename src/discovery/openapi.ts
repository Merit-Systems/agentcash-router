import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';
import type { RouteEntry } from '../types.js';

export interface OpenAPIOptions {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
  contact?: { name?: string; url?: string };
  llmsTxtUrl?: string;
  ownershipProofs?: string[];
}

export function createOpenAPIHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  options: OpenAPIOptions,
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let cached: unknown = null;
  let validated = false;

  return async (_request: NextRequest): Promise<NextResponse> => {
    if (cached) return NextResponse.json(cached);

    // Barrel validation on first call
    if (!validated && pricesKeys) {
      registry.validate(pricesKeys);
      validated = true;
    }

    const { createDocument } = await import('zod-openapi');

    const paths: Record<string, Record<string, unknown>> = {};
    const tagSet = new Set<string>();
    let requiresSiwxScheme = false;
    let requiresApiKeyScheme = false;

    for (const [key, entry] of registry.entries()) {
      const apiPath = `/api/${entry.path ?? key}`;
      const method = entry.method.toLowerCase();
      const tag = deriveTag(key);
      tagSet.add(tag);
      const built = buildOperation(key, entry, tag);
      if (built.requiresSiwxScheme) requiresSiwxScheme = true;
      if (built.requiresApiKeyScheme) requiresApiKeyScheme = true;

      // Merge, don't overwrite: multiple HTTP methods on the same path
      // are standard REST (GET + DELETE on /jobs/{id}). Each method gets
      // its own operation under the shared path key.
      paths[apiPath] = { ...paths[apiPath], [method]: built.operation };
    }

    const securitySchemes: Record<string, unknown> = {};
    if (requiresSiwxScheme) {
      securitySchemes.siwx = {
        type: 'apiKey',
        in: 'header',
        name: 'SIGN-IN-WITH-X',
      };
    }
    if (requiresApiKeyScheme) {
      securitySchemes.apiKey = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      };
    }

    const discoveryMetadata: Record<string, unknown> = {};
    if (options.ownershipProofs && options.ownershipProofs.length > 0) {
      discoveryMetadata.ownershipProofs = options.ownershipProofs;
    }
    if (options.llmsTxtUrl) {
      discoveryMetadata.llmsTxtUrl = options.llmsTxtUrl;
    }

    const openApiDocument: Record<string, unknown> = {
      openapi: '3.1.0',
      info: {
        title: options.title,
        description: options.description,
        version: options.version,
        ...(options.contact && { contact: options.contact }),
      },
      servers: [{ url: (options.baseUrl ?? normalizedBase).replace(/\/+$/, '') }],
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

    return NextResponse.json(cached);
  };
}

function deriveTag(routeKey: string): string {
  return routeKey
    .split('/')[0]
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function buildOperation(
  routeKey: string,
  entry: RouteEntry,
  tag: string,
): {
  operation: Record<string, unknown>;
  requiresSiwxScheme: boolean;
  requiresApiKeyScheme: boolean;
} {
  const protocols = entry.protocols.length > 0 ? entry.protocols : undefined;
  const paymentRequired = Boolean(entry.pricing) || entry.authMode === 'paid';
  const requiresSiwxScheme = entry.authMode === 'siwx' || Boolean(entry.siwxEnabled);
  const requiresApiKeyScheme = Boolean(entry.apiKeyResolver) && entry.authMode !== 'siwx';
  const pricingInfo = buildPricingInfo(entry);

  const operation: Record<string, unknown> = {
    operationId: routeKey.replace(/\//g, '_'),
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

function buildPricingInfo(entry: RouteEntry): Record<string, unknown> | undefined {
  if (!entry.pricing) return undefined;

  if (typeof entry.pricing === 'string') {
    return {
      pricingMode: 'fixed',
      price: entry.pricing,
    };
  }

  if (typeof entry.pricing === 'function') {
    return {
      pricingMode: 'quote',
      ...(entry.minPrice ? { minPrice: entry.minPrice } : {}),
      ...(entry.maxPrice ? { maxPrice: entry.maxPrice } : {}),
    };
  }

  if ('tiers' in entry.pricing) {
    const tierPrices = Object.values(entry.pricing.tiers).map((tier) => parseFloat(tier.price));
    const min = Math.min(...tierPrices);
    const max = Math.max(...tierPrices);

    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (min === max) {
        return {
          pricingMode: 'fixed',
          price: String(min),
        };
      }
      return {
        pricingMode: 'range',
        minPrice: String(min),
        maxPrice: String(max),
      };
    }

    return {
      pricingMode: 'quote',
      ...(entry.maxPrice ? { maxPrice: entry.maxPrice } : {}),
    };
  }

  return undefined;
}
