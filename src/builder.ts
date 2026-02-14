import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import type {
  HandlerContext,
  RouteEntry,
  PricingConfig,
  PaidOptions,
  AuthMode,
  ProtocolType,
  ProviderConfig,
} from './types.js';
import type { RouteRegistry } from './registry.js';
import type { OrchestrateDeps } from './orchestrate.js';
import { createRequestHandler } from './orchestrate.js';

// ---------------------------------------------------------------------------
// Type-level state tracking
// ---------------------------------------------------------------------------

type True = true;
type False = false;

// ---------------------------------------------------------------------------
// RouteBuilder
// ---------------------------------------------------------------------------

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  HasAuth extends boolean = false,
  NeedsBody extends boolean = false,
  HasBody extends boolean = false,
> {
  /** @internal */ readonly _key: string;
  /** @internal */ readonly _registry: RouteRegistry;
  /** @internal */ readonly _deps: OrchestrateDeps;
  /** @internal */ _authMode: AuthMode | null = null;
  /** @internal */ _pricing: PricingConfig | undefined;
  /** @internal */ _protocols: ProtocolType[] = ['x402'];
  /** @internal */ _maxPrice: string | undefined;
  /** @internal */ _bodySchema: ZodType | undefined;
  /** @internal */ _querySchema: ZodType | undefined;
  /** @internal */ _outputSchema: ZodType | undefined;
  /** @internal */ _description: string | undefined;
  /** @internal */ _path: string | undefined;
  /** @internal */ _method: 'GET' | 'POST' = 'POST';
  /** @internal */ _apiKeyResolver: ((key: string) => unknown | Promise<unknown>) | undefined;
  /** @internal */ _providerName: string | undefined;
  /** @internal */ _providerConfig: ProviderConfig | undefined;

  constructor(key: string, registry: RouteRegistry, deps: OrchestrateDeps) {
    this._key = key;
    this._registry = registry;
    this._deps = deps;
  }

  private fork(): this {
    const next = Object.create(Object.getPrototypeOf(this));
    Object.assign(next, this);
    // Deep-copy mutable arrays to prevent cross-chain mutation
    next._protocols = [...this._protocols];
    return next;
  }

  // -------------------------------------------------------------------------
  // Auth methods
  // -------------------------------------------------------------------------

  paid(pricing: string, options?: PaidOptions): RouteBuilder<TBody, TQuery, True, False, HasBody>;
  paid<TBodyIn>(
    pricing: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions & { maxPrice: string },
  ): RouteBuilder<TBody, TQuery, True, True, HasBody>;
  paid(
    pricing: {
      field: string;
      tiers: Record<string, { price: string; label?: string }>;
      default?: string;
    },
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, True, True, HasBody>;
  paid(
    pricing: PricingConfig,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, True, boolean, HasBody> {
    const next = this.fork() as RouteBuilder<TBody, TQuery, True, boolean, HasBody>;
    next._authMode = 'paid';
    next._pricing = pricing;
    if (options?.protocols) next._protocols = options.protocols;
    if (options?.maxPrice) next._maxPrice = options.maxPrice;

    // Registration-time validation
    if (typeof pricing === 'function' && !options?.maxPrice) {
      throw new Error(`route '${this._key}': dynamic pricing requires maxPrice option`);
    }
    if (typeof pricing === 'object' && 'tiers' in pricing) {
      for (const [tierKey, tierConfig] of Object.entries(pricing.tiers)) {
        if (!tierKey) {
          throw new Error(`route '${this._key}': tier key cannot be empty`);
        }
        const tierPrice = parseFloat(tierConfig.price);
        if (isNaN(tierPrice) || tierPrice <= 0) {
          throw new Error(
            `route '${this._key}': tier '${tierKey}' price '${tierConfig.price}' must be a positive decimal string`,
          );
        }
      }
    }
    if (options?.maxPrice !== undefined) {
      const parsed = parseFloat(options.maxPrice);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(
          `route '${this._key}': maxPrice '${options.maxPrice}' must be a positive decimal string`,
        );
      }
    }

    return next;
  }

  siwx(): HasAuth extends true ? never : RouteBuilder<TBody, TQuery, True, False, HasBody> {
    const next = this.fork() as RouteBuilder<TBody, TQuery, True, False, HasBody>;
    next._authMode = 'siwx';
    next._protocols = [];
    return next as never;
  }

  apiKey(
    resolver: (key: string) => unknown | Promise<unknown>,
  ): RouteBuilder<TBody, TQuery, True, NeedsBody, HasBody> {
    const next = this.fork() as RouteBuilder<TBody, TQuery, True, NeedsBody, HasBody>;
    next._authMode = 'apiKey';
    next._apiKeyResolver = resolver;
    // apiKey can compose with .paid() — auth mode will upgrade
    return next;
  }

  unprotected(): RouteBuilder<TBody, TQuery, True, False, HasBody> {
    const next = this.fork() as RouteBuilder<TBody, TQuery, True, False, HasBody>;
    next._authMode = 'unprotected';
    next._protocols = [];
    return next;
  }

  // -------------------------------------------------------------------------
  // Provider monitoring
  // -------------------------------------------------------------------------

  provider(name: string, config?: ProviderConfig): this {
    const next = this.fork();
    next._providerName = name;
    next._providerConfig = config ?? {};
    return next;
  }

  // -------------------------------------------------------------------------
  // Schema methods
  // -------------------------------------------------------------------------

  body<T>(schema: ZodType<T>): RouteBuilder<T, TQuery, HasAuth, NeedsBody, True> {
    const next = this.fork() as unknown as RouteBuilder<T, TQuery, HasAuth, NeedsBody, True>;
    next._bodySchema = schema;
    return next;
  }

  query<T>(schema: ZodType<T>): RouteBuilder<TBody, T, HasAuth, NeedsBody, HasBody> {
    const next = this.fork() as unknown as RouteBuilder<TBody, T, HasAuth, NeedsBody, HasBody>;
    next._querySchema = schema;
    next._method = 'GET';
    return next;
  }

  output(schema: ZodType): this {
    const next = this.fork();
    next._outputSchema = schema;
    return next;
  }

  description(text: string): this {
    const next = this.fork();
    next._description = text;
    return next;
  }

  path(p: string): this {
    const next = this.fork();
    next._path = p;
    return next;
  }

  // -------------------------------------------------------------------------
  // Terminal method
  // -------------------------------------------------------------------------

  handler(this: RouteBuilder<TBody, TQuery, True, true, false>, fn: never): never;
  handler(this: RouteBuilder<TBody, TQuery, false, boolean, boolean>, fn: never): never;
  handler(
    this: RouteBuilder<TBody, TQuery, True, False, HasBody>,
    fn: (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>,
  ): (request: NextRequest) => Promise<Response>;
  handler(
    this: RouteBuilder<TBody, TQuery, True, True, True>,
    fn: (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>,
  ): (request: NextRequest) => Promise<Response>;
  handler(
    fn: (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>,
  ): (request: NextRequest) => Promise<Response> {
    // Build route entry
    const entry: RouteEntry = {
      key: this._key,
      authMode: this._authMode!,
      pricing: this._pricing,
      protocols: this._protocols,
      bodySchema: this._bodySchema,
      querySchema: this._querySchema,
      outputSchema: this._outputSchema,
      description: this._description,
      path: this._path,
      method: this._method,
      maxPrice: this._maxPrice,
      apiKeyResolver: this._apiKeyResolver,
      providerName: this._providerName,
      providerConfig: this._providerConfig,
    };

    // Register in registry
    this._registry.register(entry);

    // Compile to request handler
    return createRequestHandler(entry, fn as (ctx: HandlerContext) => Promise<unknown>, this._deps);
  }
}
