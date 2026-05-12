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

type HandlerFnFor<TBody, TQuery, IsDynamic extends boolean> = IsDynamic extends true
  ? RequestHandlerFn<TBody, TQuery> | StreamingHandlerFn<TBody, TQuery>
  : RequestHandlerFn<TBody, TQuery>;

type HandlerArg<
  TBody,
  TQuery,
  HasAuth extends boolean,
  NeedsBody extends boolean,
  HasBody extends boolean,
  IsDynamic extends boolean,
> = HasAuth extends true
  ? [NeedsBody, HasBody] extends [true, false]
    ? {
        __missing: 'Call .body(schema) — dynamic/tiered pricing requires a body schema to resolve the price against';
      }
    : HandlerFnFor<TBody, TQuery, IsDynamic>
  : {
      __missing: 'Select an auth mode: .paid(pricing), .siwx(), .apiKey(resolver), or .unprotected()';
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

  paid(
    pricing: string,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, IsDynamic>;
  paid(
    options: PaidOptions & { dynamic: true; maxPrice: string },
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, True>;
  paid<TBodyIn>(
    pricing: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions & { maxPrice?: string },
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody, IsDynamic>;
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

  provider(name: string, config?: ProviderConfig): this {
    const next = this.fork();
    next._providerName = name;
    next._providerConfig = config ?? {};
    return next;
  }

  body<T>(
    schema: ZodType<T>,
  ): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True, IsDynamic>;
  body<T>(
    schema: ZodType<T>,
    example: T & JsonObject,
  ): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True, IsDynamic>;
  body<T>(
    schema: ZodType<T>,
    example?: T & JsonObject,
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
    if (example !== undefined) {
      next._inputExample = example;
      next._hasInputExample = true;
    }
    return next;
  }

  query<T>(
    schema: ZodType<T>,
  ): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  query<T>(
    schema: ZodType<T>,
    example: T & JsonObject,
  ): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  query<T>(
    schema: ZodType<T>,
    example?: T & JsonObject,
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
    if (example !== undefined) {
      next._inputExample = example;
      next._hasInputExample = true;
    }
    next._method = 'GET';
    return next;
  }

  output<T>(
    schema: ZodType<T>,
  ): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody, IsDynamic>;
  output<T>(
    schema: ZodType<T>,
    example: T & JsonValue,
  ): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody, IsDynamic>;
  output<T>(
    schema: ZodType<T>,
    example?: T & JsonValue,
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
    if (example !== undefined) {
      next._outputExample = example;
      next._hasOutputExample = true;
    }
    return next;
  }

  /**
   * Attach a conforming example of the request input (body or query) for
   * discovery extensions. Validated against the registered schema at
   * registration. Prefer passing `example` directly to `.body()` / `.query()`.
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
   * Attach a conforming example of the response output (any JSON value,
   * including top-level arrays) for discovery extensions. Validated against
   * the registered output schema. Prefer passing `example` directly to
   * `.output()`.
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

  /**
   * Pre-payment validation. Runs after body parsing, before the 402 challenge.
   * Requires `.body()` — call `.body()` first for type inference.
   * Throw with `Object.assign(new Error('...'), { status })` to control the
   * response code (defaults to 400).
   */
  validate(
    fn: (body: TBody) => void | Promise<void>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork();
    next._validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  }

  /**
   * Route-specific settlement hooks. `beforeSettle` runs after a successful
   * handler response but before router-controlled settlement/broadcast, so it
   * can still prevent the charge for x402 and MPP transaction-payload flows.
   * `afterSettle` runs after settlement.
   */
  settlement(
    lifecycle: SettlementLifecycle<TBody>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic> {
    const next = this.fork();
    next._settlement = lifecycle;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>;
  }

  handler(
    fn: HandlerArg<TBody, TQuery, HasAuth, NeedsBody, HasBody, IsDynamic>,
  ): (request: NextRequest) => Promise<Response> {
    const handlerFn = fn as unknown as (
      ctx: HandlerContext<TBody, TQuery>,
    ) => Promise<unknown> | AsyncIterable<unknown>;
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
    const isStreaming = isAsyncGeneratorFunction(handlerFn);
    if (isStreaming && !this._dynamicPrice) {
      throw new Error(
        `route '${this._key}': streaming handlers (async function*) require .paid({ dynamic: true }) — ` +
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
      streaming: isStreaming ? true : undefined,
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

    return createRequestHandler(entry, handlerFn as RouteHandler, this._deps);
  }
}

function isAsyncGeneratorFunction(fn: unknown): boolean {
  return typeof fn === 'function' && fn.constructor?.name === 'AsyncGeneratorFunction';
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
