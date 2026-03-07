import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { RouteRegistry } from '../registry.js';
import type { RouteEntry, DiscoveryConfig } from '../types.js';
import { resolveGuidance } from './utils/guidance.js';
import { OpenApiDocSchema } from '@agentcash/discovery/schemas';
import type { OpenApiDoc, OpenApiOperation, OpenApiPaymentInfo } from '@agentcash/discovery/schemas';

type RouterPathItem = Partial<Record<'get' | 'post' | 'put' | 'delete' | 'patch', OpenApiOperation>>;

export function createOpenAPIHandler(
  registry: RouteRegistry,
  baseUrl: string,
  discovery: DiscoveryConfig,
) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let cached: OpenApiDoc | null = null;

  return async (_request: NextRequest): Promise<NextResponse> => {
    if (cached) return NextResponse.json(cached);

    if (registry.size === 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[agentcash/router] openapi() called but no routes are registered. ' +
          'You must import all route handler files into this file.',
      );
    }

    const paths: Record<string, RouterPathItem> = {};
    const tagSet = new Set<string>();
    let requiresSiwxScheme = false;
    let requiresApiKeyScheme = false;

    for (const [key, entry] of registry.entries()) {
      const apiPath = `/api/${entry.path ?? key}`;
      const method = entry.method.toLowerCase() as keyof RouterPathItem;
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
      securitySchemes.siwx = { type: 'apiKey', in: 'header', name: 'SIGN-IN-WITH-X' };
    }
    if (requiresApiKeyScheme) {
      securitySchemes.apiKey = { type: 'apiKey', in: 'header', name: 'X-API-Key' };
    }

    const guidance = await resolveGuidance(discovery);

    const openApiDocument: OpenApiDoc = {
      openapi: '3.1.0',
      info: {
        title: discovery.title,
        description: discovery.description,
        version: discovery.version,
        guidance,
      },
      servers: [{ url: (discovery.serverUrl ?? normalizedBase).replace(/\/+$/, '') }],
      tags: Array.from(tagSet).sort().map((name) => ({ name })),
      ...(Object.keys(securitySchemes).length > 0 ? { components: { securitySchemes } } : {}),
      ...(discovery.ownershipProofs?.length
        ? { 'x-discovery': { ownershipProofs: discovery.ownershipProofs } }
        : {}),
      paths,
    };

    cached = openApiDocument;

    const check = OpenApiDocSchema.safeParse(cached);
    if (!check.success) {
      throw new Error(
        `[agentcash-router] OpenAPI document failed discovery schema validation:\n${JSON.stringify(check.error.issues, null, 2)}`,
      );
    }

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
  operation: OpenApiOperation;
  requiresSiwxScheme: boolean;
  requiresApiKeyScheme: boolean;
} {
  const protocols = entry.protocols.length > 0 ? entry.protocols : undefined;
  const paymentRequired = Boolean(entry.pricing) || entry.authMode === 'paid';
  const requiresSiwxScheme = entry.authMode === 'siwx' || Boolean(entry.siwxEnabled);
  const requiresApiKeyScheme = Boolean(entry.apiKeyResolver) && entry.authMode !== 'siwx';
  const pricingInfo = buildPricingInfo(entry);

  const operation: OpenApiOperation = {
    operationId: routeKey.replace(/\//g, '_'),
    summary: entry.description ?? routeKey,
    tags: [tag],
    responses: {
      '200': {
        description: 'Successful response',
        ...(entry.outputSchema && {
          content: { 'application/json': { schema: z.toJSONSchema(entry.outputSchema) } },
        }),
      },
      ...((paymentRequired || requiresSiwxScheme) && {
        '402': {
          description: requiresSiwxScheme ? 'Authentication Required' : 'Payment Required',
        },
      }),
      ...(requiresApiKeyScheme && { '401': { description: 'Unauthorized' } }),
    },
  };

  if (paymentRequired) {
    // pricingInfo is undefined for auto-priced routes (resolved at request time via `prices` map).
    // Default to 'quote' so x-payment-info always has the required pricingMode field.
    const xPaymentInfo: OpenApiPaymentInfo = {
      ...(pricingInfo ?? { pricingMode: 'quote' }),
      ...(protocols ? { protocols } : {}),
    };
    operation['x-payment-info'] = xPaymentInfo;
  }

  if (requiresSiwxScheme) {
    operation.security = [{ siwx: [] }];
  } else if (requiresApiKeyScheme) {
    operation.security = [{ apiKey: [] }];
  }

  if (entry.bodySchema) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: z.toJSONSchema(entry.bodySchema) } },
    };
  }

  if (entry.querySchema) {
    const queryJsonSchema = z.toJSONSchema(entry.querySchema) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const required = new Set(queryJsonSchema.required ?? []);
    operation.parameters = Object.entries(queryJsonSchema.properties ?? {}).map(
      ([name, schema]) => ({ in: 'query', name, schema, required: required.has(name) }),
    );
  }

  return { operation, requiresSiwxScheme, requiresApiKeyScheme };
}

function buildPricingInfo(entry: RouteEntry): OpenApiPaymentInfo | undefined {
  if (!entry.pricing) return undefined;

  if (typeof entry.pricing === 'string') {
    return { pricingMode: 'fixed', price: entry.pricing };
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
      if (min === max) return { pricingMode: 'fixed', price: String(min) };
      return { pricingMode: 'range', minPrice: String(min), maxPrice: String(max) };
    }

    return { pricingMode: 'quote', ...(entry.maxPrice ? { maxPrice: entry.maxPrice } : {}) };
  }

  return undefined;
}
