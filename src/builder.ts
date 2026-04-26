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
  MppProtocolInfo,
  JsonObject,
  JsonValue,
  SettlementLifecycle,
  PayToConfig,
} from './types.js';
import type { RouteRegistry } from './registry.js';
import type { OrchestrateDeps } from './orchestrate.js';
import { createRequestHandler } from './orchestrate.js';
import { validateExamples } from './validate-examples.js';

// ---------------------------------------------------------------------------
// Type-level state tracking
// ---------------------------------------------------------------------------

type True = true;
type False = false;

/**
 * Active request-input type at a builder position. Resolves to `TBody` when
 * `.body()` has been called, `TQuery` when `.query()` has been called, and
 * `never` when neither — making `.inputExample()` unusable before a schema
 * is set (the literal won't assign to `never`).
 */
type InputTypeFor<TBody, TQuery> = [TBody] extends [undefined]
  ? [TQuery] extends [undefined]
    ? never
    : TQuery
  : TBody;

/**
 * The handler argument type. Narrows to the real handler signature when the
 * builder state is valid, and to a descriptive error object when it isn't —
 * the mismatch surfaces as a TS type error at the `.handler(...)` call site
 * with the `__missing` string as the contextual hint.
 *
 * Encoded as a conditional argument rather than overload `this:` constraints
 * because TypeScript doesn't reliably gate overload selection on `this` for
 * generic classes (structurally identical instance types collapse).
 */
type HandlerArg<
  TBody,
  TQuery,
  HasAuth extends boolean,
  NeedsBody extends boolean,
  HasBody extends boolean,
> = HasAuth extends true
  ? [NeedsBody, HasBody] extends [true, false]
    ? {
        __missing: 'Call .body(schema) — dynamic/tiered pricing requires a body schema to resolve the price against';
      }
    : (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>
  : {
      __missing: 'Select an auth mode: .paid(pricing), .siwx(), .apiKey(resolver), or .unprotected()';
    };

// ---------------------------------------------------------------------------
// RouteBuilder
// ---------------------------------------------------------------------------

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  TOutput = undefined,
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
  /** @internal */ _payTo: PayToConfig | undefined;
  /** @internal */ _bodySchema: ZodType | undefined;
  /** @internal */ _querySchema: ZodType | undefined;
  /** @internal */ _outputSchema: ZodType | undefined;
  /** @internal */ _inputExample: JsonObject | undefined = undefined;
  /** @internal */ _hasInputExample = false;
  /** @internal */ _outputExample: JsonValue | undefined = undefined;
  /** @internal */ _hasOutputExample = false;
  /** @internal */ _description: string | undefined;
  /** @internal */ _path: string | undefined;
  /** @internal */ _method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'POST';
  /** @internal */ _apiKeyResolver: ((key: string) => unknown | Promise<unknown>) | undefined;
  /** @internal */ _providerName: string | undefined;
  /** @internal */ _providerConfig: ProviderConfig | undefined;
  /** @internal */ _validateFn: ((body: TBody) => void | Promise<void>) | undefined;
  /** @internal */ _settlement: SettlementLifecycle<TBody> | undefined;
  /** @internal */ _mppInfo: MppProtocolInfo | undefined;

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

  paid(
    pricing: string,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody>;
  paid<TBodyIn>(
    pricing: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions & { maxPrice?: string },
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody>;
  paid(
    pricing: {
      field: string;
      tiers: Record<string, { price: string; label?: string }>;
      default?: string;
    },
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody>;
  paid(
    pricing: PricingConfig,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, boolean, HasBody> {
    if (this._authMode === 'unprotected') {
      throw new Error(
        `route '${this._key}': Cannot combine .unprotected() and .paid() on the same route.`,
      );
    }
    if (this._pricing !== undefined) {
      throw new Error(
        `route '${this._key}': Cannot call .paid() more than once on the same route.`,
      );
    }

    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, boolean, HasBody>;
    next._authMode = 'paid';
    next._pricing = pricing;
    if (options?.protocols) {
      next._protocols = [...options.protocols];
    } else if (next._protocols.length === 0) {
      next._protocols = ['x402'];
    }
    if (options?.maxPrice) next._maxPrice = options.maxPrice;
    if (options?.minPrice) next._minPrice = options.minPrice;
    if (options?.payTo) next._payTo = options.payTo;
    if (options?.mpp) next._mppInfo = options.mpp;

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

  siwx(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody> {
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

    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody>;
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
  ): RouteBuilder<TBody, TQuery, TOutput, True, NeedsBody, HasBody> {
    if (this._siwxEnabled) {
      throw new Error(
        `route '${this._key}': Combining .apiKey() and .siwx() is not supported on the same route.`,
      );
    }
    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, NeedsBody, HasBody>;
    next._authMode = 'apiKey';
    next._apiKeyResolver = resolver;
    // apiKey can compose with .paid() — auth mode will upgrade
    return next;
  }

  unprotected(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody> {
    if (this._authMode && this._authMode !== 'unprotected') {
      throw new Error(
        `route '${this._key}': Cannot combine .unprotected() and .${this._authMode}() on the same route.`,
      );
    }

    if (this._pricing) {
      throw new Error(
        `route '${this._key}': Cannot combine .unprotected() and .paid() on the same route.`,
      );
    }

    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody>;
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

  body<T>(schema: ZodType<T>): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True>;
  body<T>(
    schema: ZodType<T>,
    example: T & JsonObject,
  ): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True>;
  body<T>(
    schema: ZodType<T>,
    example?: T & JsonObject,
  ): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True> {
    const next = this.fork() as unknown as RouteBuilder<
      T,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      True
    >;
    next._bodySchema = schema;
    if (example !== undefined) {
      next._inputExample = example;
      next._hasInputExample = true;
    }
    return next;
  }

  query<T>(schema: ZodType<T>): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody>;
  query<T>(
    schema: ZodType<T>,
    example: T & JsonObject,
  ): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody>;
  query<T>(
    schema: ZodType<T>,
    example?: T & JsonObject,
  ): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      T,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody
    >;
    next._querySchema = schema;
    if (example !== undefined) {
      next._inputExample = example;
      next._hasInputExample = true;
    }
    next._method = 'GET';
    return next;
  }

  output<T>(schema: ZodType<T>): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody>;
  output<T>(
    schema: ZodType<T>,
    example: T & JsonValue,
  ): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody>;
  output<T>(
    schema: ZodType<T>,
    example?: T & JsonValue,
  ): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      T,
      HasAuth,
      NeedsBody,
      HasBody
    >;
    next._outputSchema = schema;
    if (example !== undefined) {
      next._outputExample = example;
      next._hasOutputExample = true;
    }
    return next;
  }

  /**
   * Provide a conforming example of the request input (body or query params).
   *
   * Optional. When provided, the example is validated against the request schema
   * at route registration and embedded in the bazaar discovery extension so
   * indexers can advertise a working sample call.
   *
   * For the common case, pass the example directly to `.body(schema, example)` or
   * `.query(schema, example)` instead.
   *
   * @example
   * ```ts
   * router.route('search')
   *   .paid('0.01')
   *   .body(z.object({ q: z.string() }))
   *   .inputExample({ q: 'hello world' })
   *   .handler(async ({ body }) => { ... });
   * ```
   */
  inputExample(
    example: InputTypeFor<TBody, TQuery> & JsonObject,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody
    >;
    next._inputExample = example;
    next._hasInputExample = true;
    return next;
  }

  /**
   * Provide a conforming example of the response output.
   *
   * Optional. When provided, the example is validated against the output schema
   * at route registration and embedded in the bazaar discovery extension so
   * indexers can advertise the response shape.
   *
   * For the common case, pass the example directly to `.output(schema, example)` instead.
   *
   * Accepts any JSON value (objects, arrays, or primitives) — top-level array
   * or primitive responses (e.g. `z.array(...)`) are supported alongside the
   * common object case.
   *
   * @example
   * ```ts
   * router.route('search')
   *   .paid('0.01')
   *   .output(z.object({ results: z.array(z.string()) }))
   *   .outputExample({ results: ['a', 'b'] })
   *   .handler(async () => { ... });
   *
   * // Top-level array response
   * router.route('chains')
   *   .paid('0.01')
   *   .output(z.array(z.object({ name: z.string() })))
   *   .outputExample([{ name: 'Ethereum' }])
   *   .handler(async () => { ... });
   * ```
   */
  outputExample(
    example: TOutput & JsonValue,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody
    >;
    next._outputExample = example;
    next._hasOutputExample = true;
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
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody> {
    const next = this.fork();
    next._validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody>;
  }

  // -------------------------------------------------------------------------
  // Settlement lifecycle
  // -------------------------------------------------------------------------

  /**
   * Add route-specific settlement hooks.
   *
   * `beforeSettle` runs after a successful handler response but before
   * router-controlled settlement/broadcast, so it can still prevent the charge
   * for x402 and MPP transaction-payload flows. `afterSettle` runs after
   * settlement and is intended for durable ledgers or app-owned refund queues.
   */
  settlement(
    lifecycle: SettlementLifecycle<TBody>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody> {
    const next = this.fork();
    next._settlement = lifecycle;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody>;
  }

  // -------------------------------------------------------------------------
  // Terminal method
  // -------------------------------------------------------------------------

  handler(
    fn: HandlerArg<TBody, TQuery, HasAuth, NeedsBody, HasBody>,
  ): (request: NextRequest) => Promise<Response> {
    // The conditional `HandlerArg` type forces `fn` to be a function when state
    // is valid; the error-object branches block invalid calls at compile time,
    // so at runtime `fn` is always a handler function.
    const handlerFn = fn as unknown as (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>;
    // Registration-time validation
    if (!this._authMode) {
      throw new Error(
        `route '${this._key}': Select an auth mode: .paid(pricing), .siwx(), .apiKey(resolver), or .unprotected()`,
      );
    }
    if (this._validateFn && !this._bodySchema) {
      throw new Error(
        `route '${this._key}': .validate() requires .body() — validation runs on parsed body`,
      );
    }
    if (this._settlement && !this._pricing) {
      throw new Error(`route '${this._key}': .settlement() requires a paid route`);
    }

    validateExamples(
      this._key,
      this._bodySchema,
      this._querySchema,
      this._outputSchema,
      this._inputExample,
      this._hasInputExample,
      this._outputExample,
      this._hasOutputExample,
    );

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
      inputExample: this._hasInputExample ? this._inputExample : undefined,
      outputExample: this._hasOutputExample ? this._outputExample : undefined,
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
      settlement: this._settlement as SettlementLifecycle | undefined,
      mppInfo: this._mppInfo,
    };

    // Register in registry
    this._registry.register(entry);

    // Compile to request handler
    return createRequestHandler(
      entry,
      handlerFn as (ctx: HandlerContext) => Promise<unknown>,
      this._deps,
    );
  }
}
