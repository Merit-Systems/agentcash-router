import { z, type ZodType } from 'zod';
import type { RouteRegistry } from '../registry.js';
import type { RouteEntry, DiscoveryConfig } from '../types.js';
import { TEMPO_USDC_ADDRESS } from '../constants.js';
import { HEADERS } from '../headers.js';
import { tierPriceExtrema } from '../pipeline/next-step.js';
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
      const built = buildOperation(entry.key, entry, tag);
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

/**
 * Shape of the `next` array the router appends to successful JSON responses
 * on routes that declare `.nextStep()`. Chains live ONLY in the runtime
 * response body (always resolved, `when()`-filtered, current prices) — they
 * are deliberately NOT mirrored as static `x-next`/`links` here, since a
 * static copy is strictly stale. This schema exists so advertised output
 * schemas stay truthful about the injected key.
 */
const NEXT_ENTRY_SCHEMA = z.object({
  method: z.string(),
  url: z.string(),
  auth: z.string(),
  price: z.union([z.string(), z.object({ min: z.string(), max: z.string() })]).optional(),
  note: z.string().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
});

/** Advertised output schema: the declared `.output()` plus the optional injected `next` array. */
function advertisedOutputSchema(entry: RouteEntry): ZodType | undefined {
  if (!entry.outputSchema) return undefined;
  if (!entry.nextSteps || entry.nextSteps.length === 0) return entry.outputSchema;
  if (!(entry.outputSchema instanceof z.ZodObject)) return entry.outputSchema;
  return entry.outputSchema.extend({
    next: z
      .array(NEXT_ENTRY_SCHEMA)
      .optional()
      .describe('Appended by the router: the next call(s) to make, fully resolved, with price.'),
  });
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
    entry.protocols.length > 0
      ? entry.protocols.map((p) => toProtocolObject(p, entry.mppInfo))
      : undefined;
  const paymentRequired = Boolean(entry.pricing) || entry.authMode === 'paid';
  const requiresSiwxScheme = entry.authMode === 'siwx' || Boolean(entry.siwxEnabled);
  const requiresApiKeyScheme = Boolean(entry.apiKeyResolver) && entry.authMode !== 'siwx';
  const pricingInfo = buildPricingInfo(entry);
  const outputSchema = advertisedOutputSchema(entry);

  const operation: Record<string, unknown> = {
    operationId: toOperationId(routeKey),
    summary: entry.description ?? routeKey,
    tags: [tag],
    responses: {
      '200': {
        description: 'Successful response',
        ...(outputSchema && {
          content: {
            'application/json': { schema: outputSchema },
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
