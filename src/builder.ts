import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import type {
  HandlerContext,
  StreamingHandlerContext,
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
import type { OrchestrateDeps, RouteHandler } from './orchestrate.js';
import { createRequestHandler } from './orchestrate.js';
import { validateExamples } from './validate-examples.js';

type True = true;
type False = false;

type InputTypeFor<TBody, TQuery> = [TBody] extends [undefined]
  ? [TQuery] extends [undefined]
    ? never
    : TQuery
  : TBody;

type RequestHandlerFn<TBody, TQuery> = (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>;

type StreamingHandlerFn<TBody, TQuery> = (
  ctx: StreamingHandlerContext<TBody, TQuery>,
) => AsyncIterable<unknown>;

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
    : RequestHandlerFn<TBody, TQuery>
  : {
      __missing: 'Select an auth mode: .paid(pricing), .siwx(), .apiKey(resolver), or .unprotected()';
    };

type StreamArg<
  TBody,
  TQuery,
  HasAuth extends boolean,
  NeedsBody extends boolean,
  HasBody extends boolean,
  IsDynamic extends boolean,
> = HasAuth extends true
  ? IsDynamic extends true
    ? [NeedsBody, HasBody] extends [true, false]
      ? {
          __missing: 'Call .body(schema) — dynamic pricing requires a body schema to resolve the price against';
        }
      : StreamingHandlerFn<TBody, TQuery>
    : {
        __missing: 'Streaming handlers require .paid({ dynamic: true, tickCost, unitType, maxPrice }) — static/free routes cannot meter per-chunk billing';
      }
  : {
      __missing: 'Select an auth mode: .paid({ dynamic: true, ... }) — streaming requires handler-driven dynamic pricing';
    };

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  TOutput = undefined,
  HasAuth extends boolean = false,
  NeedsBody extends boolean = false,
  HasBody extends boolean = false,
  IsDynamic extends boolean = false,
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
  /** @internal */ _dynamicPrice = false;
  /** @internal */ _tickCost: string | undefined;
  /** @internal */ _unitType: string | undefined;
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
    next._protocols = [...this._protocols];
    return next;
  }

  /**
   * Charge a fixed price per request, denominated in USDC as a decimal string.
   *
   * @example
   * ```ts
   * router.route('search').paid('0.01').handler(handler);
   * ```
   */
  paid(
    pricing: string,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, IsDynamic>;
  /**
   * Configure handler-driven dynamic pricing — each tick costs `tickCost` USDC,
   * capped at `maxPrice`. Pair with `.handler()` for one-tick-per-request
   * billing, or with `.stream()` for per-yield metering.
   *
   * @example
   * ```ts
   * router
   *   .route('llm/stream')
   *   .paid({ dynamic: true, tickCost: '0.0001', unitType: 'token', maxPrice: '0.05' })
   *   .stream(async function* ({ charge }) { await charge(); yield 'hi'; });
   * ```
   */
  paid(
    options: PaidOptions & { dynamic: true; maxPrice: string },
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, True>;
  /**
   * Compute the price from the parsed body before issuing the 402 challenge.
   * Throw an `HttpError` from the pricing function to reject the request before
   * payment is requested.
   *
   * @example
   * ```ts
   * router
   *   .route('llm')
   *   .paid((body) => `${body.tokens * 0.0001}`, { maxPrice: '5.00' })
   *   .body(schema)
   *   .handler(handler);
   * ```
   */
  paid<TBodyIn>(
    pricing: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions & { maxPrice?: string },
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody, IsDynamic>;
  /**
   * Select a price tier from `body[field]`, optionally falling back to the
   * `default` tier when the value is missing. The 402 challenge advertises the
   * highest tier price.
   *
   * @example
   * ```ts
   * router
   *   .route('upload')
   *   .paid({ field: 'size', tiers: { sm: { price: '0.01' }, lg: { price: '0.10' } } })
   *   .body(schema)
   *   .handler(handler);
   * ```
   */
  paid(
    pricing: {
      field: string;
      tiers: Record<string, { price: string; label?: string }>;
      default?: string;
    },
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody, IsDynamic>;
  paid(
    pricingOrOptions: PricingConfig | (PaidOptions & { dynamic: true; maxPrice: string }),
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, boolean, HasBody, boolean> {
    const { pricing, resolvedOptions } = resolvePaidArgs(this._key, pricingOrOptions, options);

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

    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      boolean,
      HasBody,
      boolean
    >;
    next._authMode = 'paid';
    next._pricing = pricing;
    if (resolvedOptions?.protocols) {
      next._protocols = [...resolvedOptions.protocols];
    } else if (next._protocols.length === 0) {
      next._protocols = ['x402'];
    }
    if (resolvedOptions?.maxPrice) next._maxPrice = resolvedOptions.maxPrice;
    if (resolvedOptions?.minPrice) next._minPrice = resolvedOptions.minPrice;
    if (resolvedOptions?.payTo) next._payTo = resolvedOptions.payTo;
    if (resolvedOptions?.mpp) next._mppInfo = resolvedOptions.mpp;
    if (resolvedOptions?.dynamic) next._dynamicPrice = true;
    if (resolvedOptions?.tickCost) next._tickCost = resolvedOptions.tickCost;
    if (resolvedOptions?.unitType) next._unitType = resolvedOptions.unitType;

    if (typeof pricing === 'object' && 'tiers' in pricing) {
      if (next._dynamicPrice) {
        throw new Error(
          `route '${this._key}': .paid({ dynamic: true }) is incompatible with tiered pricing`,
        );
      }
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
    if (resolvedOptions?.maxPrice !== undefined) {
      const parsed = parseFloat(resolvedOptions.maxPrice);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(
          `route '${this._key}': maxPrice '${resolvedOptions.maxPrice}' must be a positive decimal string`,
        );
      }
    }
    if (resolvedOptions?.tickCost !== undefined) {
      const parsed = parseFloat(resolvedOptions.tickCost);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(
          `route '${this._key}': tickCost '${resolvedOptions.tickCost}' must be a positive decimal string`,
        );
      }
    }
    if (next._dynamicPrice && !next._maxPrice) {
      throw new Error(`route '${this._key}': .paid({ dynamic: true }) requires maxPrice`);
    }
    if (next._dynamicPrice && !next._tickCost) {
      throw new Error(`route '${this._key}': .paid({ dynamic: true }) requires tickCost`);
    }

    return next;
  }

  /**
   * Require Sign-In-with-X wallet identity on this route — clients prove
   * control of a wallet via a signed challenge. Combine with `.paid()` to gate
   * a paid route on a verified wallet identity.
   *
   * @example
   * ```ts
   * router.route('profile').siwx().handler(async ({ wallet }) => getProfile(wallet));
   * ```
   */
  siwx(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, IsDynamic> {
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

    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      False,
      HasBody,
      IsDynamic
    >;
    next._siwxEnabled = true;

    if (next._authMode === 'paid' || next._pricing) {
      next._authMode = 'paid';
      if (next._protocols.length === 0) next._protocols = ['x402'];
      return next;
    }

    next._authMode = 'siwx';
    next._protocols = [];
    return next;
  }

  /**
   * Require an `X-API-Key` header (or `Authorization: Bearer <key>`); the
   * resolver returns the account record, or `null` for 401. Composes with
   * `.paid()` — key is checked first, payment second.
   *
   * @example
   * ```ts
   * router
   *   .route('admin/users')
   *   .apiKey(async (key) => db.admin.findByKey(key))
   *   .handler(async ({ account }) => db.user.list(account.orgId));
   * ```
   */
  apiKey(
    resolver: (key: string) => unknown | Promise<unknown>,
  ): RouteBuilder<TBody, TQuery, TOutput, True, NeedsBody, HasBody, IsDynamic> {
    if (this._siwxEnabled) {
      throw new Error(
        `route '${this._key}': Combining .apiKey() and .siwx() is not supported on the same route.`,
      );
    }
    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      NeedsBody,
      HasBody,
      IsDynamic
    >;
    next._authMode = 'apiKey';
    next._apiKeyResolver = resolver;
    return next;
  }

  /**
   * Mark the route as public — no auth, no payment, no SIWX. The handler
   * receives `null` for `wallet`, `payment`, and `account`.
   *
   * @example
   * ```ts
   * router.route('health').unprotected().handler(async () => ({ status: 'ok' }));
   * ```
   */
  unprotected(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, IsDynamic> {
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

    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      False,
      HasBody,
      IsDynamic
    >;
    next._authMode = 'unprotected';
    next._protocols = [];
    return next;
  }

  /**
   * Tag the route with an upstream provider for discovery and provider-side
   * monitoring. The provider name and config surface in `well-known` and
   * OpenAPI output.
   *
   * @example
   * ```ts
   * router
   *   .route('search')
   *   .paid('0.01')
   *   .provider('exa', { quotaPerMonth: 1000 })
   *   .handler(handler);
   * ```
   */
  provider(name: string, config?: ProviderConfig): this {
    const next = this.fork();
    next._providerName = name;
    next._providerConfig = config ?? {};
    return next;
  }

  /**
   * Declare the request body's Zod schema. Parsed body is typed as `ctx.body`
   * in the handler. Use `.inputExample()` to attach a discovery example.
   *
   * @example
   * ```ts
   * .body(z.object({ query: z.string() }))
   *   .handler(async ({ body }) => search(body.query));
   * ```
   */
  body<T>(
    schema: ZodType<T>,
  ): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True, IsDynamic> {
    const next = this.fork() as unknown as RouteBuilder<
      T,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      True,
      IsDynamic
    >;
    next._bodySchema = schema;
    return next;
  }

  /**
   * Declare a query-string Zod schema and switch the route to `GET`. Parsed
   * query is typed as `ctx.query` in the handler. Use `.inputExample()` to
   * attach a discovery example.
   *
   * @example
   * ```ts
   * .query(z.object({ id: z.string() }))
   *   .handler(async ({ query }) => getById(query.id));
   * ```
   */
  query<T>(
    schema: ZodType<T>,
  ): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      T,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      IsDynamic
    >;
    next._querySchema = schema;
    next._method = 'GET';
    return next;
  }

  /**
   * Declare the response output's Zod schema for OpenAPI generation. The
   * runtime does not validate handler return values — use Zod's `.parse()`
   * inside the handler if strict output validation is required. Use
   * `.outputExample()` to attach a discovery example.
   *
   * @example
   * ```ts
   * .output(z.object({ result: z.string() }))
   *   .handler(async () => ({ result: 'ok' }));
   * ```
   */
  output<T>(
    schema: ZodType<T>,
  ): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      T,
      HasAuth,
      NeedsBody,
      HasBody,
      IsDynamic
    >;
    next._outputSchema = schema;
    return next;
  }

  /**
   * Attach an example of the request body or query for discovery output,
   * validated against the registered schema at registration.
   *
   * @example
   * ```ts
   * .body(searchSchema).inputExample({ query: 'cats' });
   * ```
   */
  inputExample(
    example: InputTypeFor<TBody, TQuery> & JsonObject,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      IsDynamic
    >;
    next._inputExample = example;
    next._hasInputExample = true;
    return next;
  }

  /**
   * Attach an example response for discovery output, validated against the
   * registered output schema at registration.
   *
   * @example
   * ```ts
   * .output(resultSchema).outputExample({ result: 'ok' });
   * ```
   */
  outputExample(
    example: TOutput & JsonValue,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      IsDynamic
    >;
    next._outputExample = example;
    next._hasOutputExample = true;
    return next;
  }

  /**
   * Set a human-readable summary of the route. Surfaces in OpenAPI,
   * `well-known`, and `llms.txt` discovery output.
   *
   * @example
   * ```ts
   * .description('Search indexed web pages by full-text query');
   * ```
   */
  description(text: string): this {
    const next = this.fork();
    next._description = text;
    return next;
  }

  /**
   * Override the URL path advertised in discovery output. Defaults to the
   * registry key passed to `.route()`.
   *
   * @example
   * ```ts
   * router.route('search').path('/v2/search').handler(handler);
   * ```
   */
  path(p: string): this {
    const next = this.fork();
    next._path = p;
    return next;
  }

  /**
   * Override the HTTP method advertised in discovery. Defaults to `POST`, or
   * `GET` when `.query()` has been called.
   *
   * @example
   * ```ts
   * router.route('items/delete').method('DELETE').handler(handler);
   * ```
   */
  method(m: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'): this {
    const next = this.fork();
    next._method = m;
    return next;
  }

  /**
   * Run validation against the parsed body before the 402 challenge. Throw
   * `Object.assign(new Error('...'), { status })` to reject with a custom
   * status code; defaults to 400. Requires `.body()` to be called first.
   *
   * @example
   * ```ts
   * .body(RegisterSchema).validate(async (body) => {
   *   if (await isTaken(body.name)) {
   *     throw Object.assign(new Error('taken'), { status: 409 });
   *   }
   * });
   * ```
   */
  validate(
    fn: (body: TBody) => void | Promise<void>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork();
    next._validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  }

  /**
   * Hook into the settlement lifecycle. `beforeSettle` runs after the handler
   * succeeds but before on-chain settlement and can cancel the charge;
   * `afterSettle` runs after settlement completes (success or failure).
   *
   * @example
   * ```ts
   * .settlement({
   *   beforeSettle: ({ result }) => (result.refund ? 'skip' : 'continue'),
   *   afterSettle: ({ tx }) => analytics.track('settled', { tx }),
   * });
   * ```
   */
  settlement(
    lifecycle: SettlementLifecycle<TBody>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork();
    next._settlement = lifecycle;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  }

  /**
   * Register the request handler and return the Next.js route function. The
   * handler receives a typed context and may return a value (serialized to
   * JSON), a raw `Response`, or throw an `HttpError` for a non-2xx status.
   *
   * @example
   * ```ts
   * export const POST = router
   *   .route('search')
   *   .paid('0.01')
   *   .body(schema)
   *   .handler(async ({ body, wallet }) => searchService(body, wallet));
   * ```
   */
  handler(
    fn: HandlerArg<TBody, TQuery, HasAuth, NeedsBody, HasBody>,
  ): (request: NextRequest) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, false);
  }

  /**
   * Register a streaming handler (`async function*`) and return the Next.js
   * route function. Each `charge()` call bills one tick (`tickCost` USDC) up
   * to `maxPrice`; requires `.paid({ dynamic: true, ... })` and MPP session mode.
   *
   * @example
   * ```ts
   * export const POST = router
   *   .route('llm/stream')
   *   .paid({ dynamic: true, tickCost: '0.0001', unitType: 'token', maxPrice: '0.05' })
   *   .body(schema)
   *   .stream(async function* ({ body, charge }) {
   *     for await (const token of streamLLM(body.prompt)) {
   *       await charge();
   *       yield token;
   *     }
   *   });
   * ```
   */
  stream(
    fn: StreamArg<TBody, TQuery, HasAuth, NeedsBody, HasBody, IsDynamic>,
  ): (request: NextRequest) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, true);
  }

  private register(
    handlerFn: RouteHandler,
    streaming: boolean,
  ): (request: NextRequest) => Promise<Response> {
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
    if (this._dynamicPrice && this._protocols.includes('x402')) {
      const hasUpto = this._deps.x402Accepts.some((accept) => accept.scheme === 'upto');
      if (!hasUpto) {
        throw new Error(
          `route '${this._key}': .paid({ dynamic: true }) on an x402 route requires an 'upto' accept on at least one configured network. ` +
            `Add { scheme: 'upto', network, asset } to RouterConfig.x402.accepts.`,
        );
      }
    }
    if (this._dynamicPrice && this._protocols.includes('mpp')) {
      if (!this._deps.mppSessionConfig) {
        throw new Error(
          `route '${this._key}': .paid({ dynamic: true }) on an MPP route requires session mode. ` +
            `Set RouterConfig.mpp.session = {} and provide mpp.operatorKey.`,
        );
      }
    }
    if (streaming && !this._dynamicPrice) {
      throw new Error(
        `route '${this._key}': .stream() requires .paid({ dynamic: true }) — ` +
          `static/free routes can't meter per-chunk billing.`,
      );
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

    const entry: RouteEntry = {
      key: this._key,
      authMode: this._authMode!,
      siwxEnabled: this._siwxEnabled,
      pricing: this._pricing,
      dynamicPrice: this._dynamicPrice ? true : undefined,
      streaming: streaming ? true : undefined,
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
      tickCost: this._tickCost,
      unitType: this._unitType,
    };

    this._registry.register(entry);

    return createRequestHandler(entry, handlerFn, this._deps);
  }
}

function resolvePaidArgs(
  routeKey: string,
  pricingOrOptions: PricingConfig | (PaidOptions & { dynamic: true; maxPrice: string }),
  options?: PaidOptions,
): { pricing: PricingConfig; resolvedOptions: PaidOptions | undefined } {
  const isHandlerDynamicShape =
    typeof pricingOrOptions === 'object' &&
    pricingOrOptions !== null &&
    typeof pricingOrOptions !== 'function' &&
    !('tiers' in pricingOrOptions) &&
    'dynamic' in pricingOrOptions &&
    pricingOrOptions.dynamic;

  if (isHandlerDynamicShape) {
    const opts = pricingOrOptions as PaidOptions & { dynamic: true; maxPrice: string };
    if (!opts.maxPrice) {
      throw new Error(`route '${routeKey}': .paid({ dynamic: true }) requires maxPrice`);
    }
    return { pricing: opts.maxPrice, resolvedOptions: opts };
  }
  return { pricing: pricingOrOptions as PricingConfig, resolvedOptions: options };
}
