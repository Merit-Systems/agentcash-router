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
// Zod v4 uses lowercase strings in _def.type. These types produce anyOf/oneOf/allOf
// in JSON Schema and do not round-trip cleanly through OpenAPI → Zod conversion.
const UNSUPPORTED_SCHEMA_TYPES = new Set(['union', 'nullable', 'intersection']);

type ZodDef = {
  type: string;
  innerType?: ZodType;
  options?: ZodType[];
  left?: ZodType;
  right?: ZodType;
  shape?: Record<string, ZodType>;
  valueType?: ZodType;
  element?: ZodType;
  items?: ZodType[];
};

function warnUnsupportedSchema(schema: ZodType, field: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const isZodType = (v: unknown): v is ZodType =>
    v != null && typeof v === 'object' && '_def' in v && typeof (v as { _def: ZodDef })._def?.type === 'string';
  const walk = (s: ZodType, path: string): void => {
    const def = (s as unknown as { _def: ZodDef })._def;
    if (UNSUPPORTED_SCHEMA_TYPES.has(def.type)) {
      console.warn(
        `[router] .${field}() schema contains "${def.type}" at "${path}" — use z.string(), z.number(), z.boolean(), or z.enum() instead. ` +
          `z.union(), z.nullable(), and z.intersection() cannot be read back from the OpenAPI spec at runtime.`,
      );
    }
    if (isZodType(def.innerType)) walk(def.innerType, path);
    if (isZodType(def.element)) walk(def.element, `${path}[]`);
    if (isZodType(def.valueType)) walk(def.valueType, `${path}{value}`);
    if (isZodType(def.left)) walk(def.left, `${path}.left`);
    if (isZodType(def.right)) walk(def.right, `${path}.right`);
    if (def.options) def.options.filter(isZodType).forEach((o, i) => walk(o, `${path}[${i}]`));
    if (def.items) def.items.filter(isZodType).forEach((o, i) => walk(o, `${path}[${i}]`));
    if (def.shape && typeof def.shape === 'object') {
      for (const [k, v] of Object.entries(def.shape)) {
        if (isZodType(v)) walk(v, `${path}.${k}`);
      }
    }
  };
  walk(schema, field);
}



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
  /** @internal */ _siwxEnabled = false;
  /** @internal */ _protocols: ProtocolType[] = ['x402'];
  /** @internal */ _maxPrice: string | undefined;
  /** @internal */ _minPrice: string | undefined;
  /** @internal */ _payTo: string | ((request: Request) => string | Promise<string>) | undefined;
  /** @internal */ _bodySchema: ZodType | undefined;
  /** @internal */ _querySchema: ZodType | undefined;
  /** @internal */ _outputSchema: ZodType | undefined;
  /** @internal */ _description: string | undefined;
  /** @internal */ _path: string | undefined;
  /** @internal */ _method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'POST';
  /** @internal */ _apiKeyResolver: ((key: string) => unknown | Promise<unknown>) | undefined;
  /** @internal */ _providerName: string | undefined;
  /** @internal */ _providerConfig: ProviderConfig | undefined;
  /** @internal */ _validateFn: ((body: TBody) => void | Promise<void>) | undefined;

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
    options?: PaidOptions & { maxPrice?: string },
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
    if (options?.protocols) {
      next._protocols = options.protocols;
    } else if (next._protocols.length === 0) {
      next._protocols = ['x402'];
    }
    if (options?.maxPrice) next._maxPrice = options.maxPrice;
    if (options?.minPrice) next._minPrice = options.minPrice;
    if (options?.payTo) next._payTo = options.payTo;

    // Registration-time validation
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

  siwx(): RouteBuilder<TBody, TQuery, True, False, HasBody> {
    if (this._authMode === 'unprotected') {
      throw new Error(
        `route '${this._key}': Cannot combine .unprotected() and .siwx() on the same route.`,
      );
    }

    if (this._apiKeyResolver) {
      throw new Error(
        `route '${this._key}': Combining .siwx() and .apiKey() is not supported on the same route.`,
      );
    }

    const next = this.fork() as RouteBuilder<TBody, TQuery, True, False, HasBody>;
    next._siwxEnabled = true;

    // If route is paid (or already has pricing), SIWX is an acceleration capability.
    if (next._authMode === 'paid' || next._pricing) {
      next._authMode = 'paid';
      if (next._protocols.length === 0) next._protocols = ['x402'];
      return next;
    }

    // Pure SIWX auth route (no payment protocol).
    next._authMode = 'siwx';
    next._protocols = [];
    return next;
  }

  apiKey(
    resolver: (key: string) => unknown | Promise<unknown>,
  ): RouteBuilder<TBody, TQuery, True, NeedsBody, HasBody> {
    if (this._siwxEnabled) {
      throw new Error(
        `route '${this._key}': Combining .apiKey() and .siwx() is not supported on the same route.`,
      );
    }
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
    warnUnsupportedSchema(schema, 'body');
    const next = this.fork() as unknown as RouteBuilder<T, TQuery, HasAuth, NeedsBody, True>;
    next._bodySchema = schema;
    return next;
  }

  query<T>(schema: ZodType<T>): RouteBuilder<TBody, T, HasAuth, NeedsBody, HasBody> {
    warnUnsupportedSchema(schema, 'query');
    const next = this.fork() as unknown as RouteBuilder<TBody, T, HasAuth, NeedsBody, HasBody>;
    next._querySchema = schema;
    next._method = 'GET';
    return next;
  }

  output(schema: ZodType): this {
    warnUnsupportedSchema(schema, 'output');
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

  method(m: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'): this {
    const next = this.fork();
    next._method = m;
    return next;
  }

  // -------------------------------------------------------------------------
  // Pre-payment validation
  // -------------------------------------------------------------------------

  /**
   * Add pre-payment validation that runs after body parsing but before the 402
   * challenge is shown. Use this for async business logic like "is this resource
   * available?" or "has this user hit their rate limit?".
   *
   * Requires `.body()` — call `.body()` before `.validate()` for type inference.
   *
   * @example
   * ```typescript
   * router
   *   .route('domain/register')
   *   .paid(calculatePrice)
   *   .body(RegisterSchema)  // .body() first for type inference
   *   .validate(async (body) => {
   *     if (await isDomainTaken(body.domain)) {
   *       throw Object.assign(new Error('Domain taken'), { status: 409 });
   *     }
   *   })
   *   .handler(async ({ body }) => { ... });
   * ```
   */
  validate(
    fn: (body: TBody) => void | Promise<void>,
  ): RouteBuilder<TBody, TQuery, HasAuth, NeedsBody, HasBody> {
    const next = this.fork();
    next._validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, HasAuth, NeedsBody, HasBody>;
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
    // Registration-time validation
    if (this._validateFn && !this._bodySchema) {
      throw new Error(
        `route '${this._key}': .validate() requires .body() — validation runs on parsed body`,
      );
    }

    // Build route entry
    const entry: RouteEntry = {
      key: this._key,
      authMode: this._authMode!,
      siwxEnabled: this._siwxEnabled,
      pricing: this._pricing,
      protocols: this._protocols,
      bodySchema: this._bodySchema,
      querySchema: this._querySchema,
      outputSchema: this._outputSchema,
      description: this._description,
      path: this._path,
      method: this._method,
      maxPrice: this._maxPrice,
      minPrice: this._minPrice,
      payTo: this._payTo,
      apiKeyResolver: this._apiKeyResolver,
      providerName: this._providerName,
      providerConfig: this._providerConfig,
      validateFn: this._validateFn as ((body: unknown) => void | Promise<void>) | undefined,
    };

    // Register in registry
    this._registry.register(entry);

    // Compile to request handler
    return createRequestHandler(entry, fn as (ctx: HandlerContext) => Promise<unknown>, this._deps);
  }
}
