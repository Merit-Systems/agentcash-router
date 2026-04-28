import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RouteRegistry } from '../registry.js';
import type { RouteEntry, DiscoveryConfig } from '../types.js';
import { TEMPO_USDC_CURRENCY } from '../constants.js';
import { resolveGuidance } from './utils/guidance.js';

export function createOpenAPIHandler(
  registry: RouteRegistry,
  baseUrl: string,
  pricesKeys: string[] | undefined,
  discovery: DiscoveryConfig,
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

    for (const [, entry] of registry.entries()) {
      const apiPath = `/api/${entry.path ?? entry.key}`;
      const method = entry.method.toLowerCase();
      const tag = deriveTag(entry.key);
      tagSet.add(tag);
      const built = buildOperation(entry.key, entry, tag);
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
  const protocols =
    entry.protocols.length > 0 ? entry.protocols.map((p) => toProtocolObject(p, entry)) : undefined;
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

function toProtocolObject(protocol: string, entry: RouteEntry): Record<string, unknown> {
  const mppInfo = entry.mppInfo;
  if (protocol === 'mpp') {
    // Variable-price routes advertise sessions, not charge — sessions are the
    // only MPP intent that supports post-work amount overrides via vouchers.
    const defaultIntent = entry.variablePrice ? 'session' : 'charge';
    return {
      mpp: {
        method: mppInfo?.method ?? 'tempo',
        intent: mppInfo?.intent ?? defaultIntent,
        currency: mppInfo?.currency ?? TEMPO_USDC_CURRENCY,
      },
    };
  }
  return { [protocol]: {} };
}

function buildPricingInfo(entry: RouteEntry): Record<string, unknown> | undefined {
  if (!entry.pricing) return undefined;

  // Variable post-work pricing — advertise the cap as `maxAmount` rather than
  // a fixed `amount` so clients understand the actual charge is decided after
  // the handler runs (capped at maxPrice).
  if (entry.variablePrice) {
    return {
      price: {
        mode: 'variable',
        currency: 'USD',
        maxAmount: entry.maxPrice ?? (typeof entry.pricing === 'string' ? entry.pricing : '0'),
      },
    };
  }

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
    const tierPrices = Object.values(entry.pricing.tiers).map((tier) => parseFloat(tier.price));
    const min = Math.min(...tierPrices);
    const max = Math.max(...tierPrices);

    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (min === max) {
        return {
          price: { mode: 'fixed', currency: 'USD', amount: String(min) },
        };
      }
      return {
        price: { mode: 'dynamic', currency: 'USD', min: String(min), max: String(max) },
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
