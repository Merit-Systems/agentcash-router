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
}

export function createOpenAPIHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  options: OpenAPIOptions,
) {
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

    for (const [key, entry] of registry.entries()) {
      const apiPath = `/api/${entry.path ?? key}`;
      const method = entry.method.toLowerCase();
      const tag = deriveTag(key);
      tagSet.add(tag);

      // Merge, don't overwrite: multiple HTTP methods on the same path
      // are standard REST (GET + DELETE on /jobs/{id}). Each method gets
      // its own operation under the shared path key.
      paths[apiPath] = { ...paths[apiPath], [method]: buildOperation(key, entry, tag) };
    }

    cached = createDocument({
      openapi: '3.1.0',
      info: {
        title: options.title,
        description: options.description,
        version: options.version,
        ...(options.contact && { contact: options.contact }),
      },
      servers: [{ url: options.baseUrl ?? baseUrl }],
      tags: Array.from(tagSet)
        .sort()
        .map((name) => ({ name })),
      paths: paths as never,
    });

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

function buildOperation(routeKey: string, entry: RouteEntry, tag: string): Record<string, unknown> {
  const protocols = entry.protocols.length > 0 ? entry.protocols : undefined;
  let price: string | undefined;
  if (typeof entry.pricing === 'string') {
    // Static pricing — exact value
    price = entry.pricing;
  } else if (typeof entry.pricing === 'object' && 'tiers' in entry.pricing) {
    // Tiered pricing — auto-compute range from lowest to highest tier
    const tierPrices = Object.values(entry.pricing.tiers).map((t) => parseFloat(t.price));
    const min = Math.min(...tierPrices);
    const max = Math.max(...tierPrices);
    price = min === max ? String(min) : `${min}-${max}`;
  } else if (entry.minPrice && entry.maxPrice) {
    // Dynamic pricing with explicit range
    price = `${entry.minPrice}-${entry.maxPrice}`;
  } else if (entry.maxPrice) {
    // Dynamic pricing with only a ceiling
    price = entry.maxPrice;
  }

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
      ...(entry.authMode === 'paid' && {
        '402': {
          description: 'Payment Required',
        },
      }),
    },
  };

  if (price !== undefined || protocols) {
    operation['x-payment-info'] = {
      ...(price !== undefined && { price }),
      ...(protocols && { protocols }),
    };
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

  return operation;
}
