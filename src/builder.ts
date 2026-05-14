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
import type { OrchestrateDeps, RouteHandler } from './pipeline/orchestrate.js';
import { createRequestHandler } from './pipeline/orchestrate.js';
import { isPositiveDecimal } from './pricing/format.js';
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

type BuilderState<TBody> = {
  key: string;
  registry: RouteRegistry;
  deps: OrchestrateDeps;
  authMode: AuthMode | null;
  pricing: PricingConfig | undefined;
  siwxEnabled: boolean;
  protocols: ProtocolType[];
  maxPrice: string | undefined;
  minPrice: string | undefined;
  dynamicPrice: boolean;
  tickCost: string | undefined;
  unitType: string | undefined;
  payTo: PayToConfig | undefined;
  bodySchema: ZodType | undefined;
  querySchema: ZodType | undefined;
  outputSchema: ZodType | undefined;
  inputExample: JsonObject | undefined;
  hasInputExample: boolean;
  outputExample: JsonValue | undefined;
  hasOutputExample: boolean;
  description: string | undefined;
  path: string | undefined;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  apiKeyResolver: ((key: string) => unknown | Promise<unknown>) | undefined;
  providerName: string | undefined;
  providerConfig: ProviderConfig | undefined;
  validateFn: ((body: TBody) => void | Promise<void>) | undefined;
  settlement: SettlementLifecycle<TBody> | undefined;
  mppInfo: MppProtocolInfo | undefined;
};

export interface RouteBuilderDefaults {
  protocols?: ProtocolType[];
}

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  TOutput = undefined,
  HasAuth extends boolean = false,
  NeedsBody extends boolean = false,
  HasBody extends boolean = false,
  IsDynamic extends boolean = false,
> {
  #s: BuilderState<TBody>;

  constructor(
    key: string,
    registry: RouteRegistry,
    deps: OrchestrateDeps,
    defaults?: RouteBuilderDefaults,
  ) {
    this.#s = {
      key,
      registry,
      deps,
      authMode: null,
      pricing: undefined,
      siwxEnabled: false,
      protocols: defaults?.protocols ? [...defaults.protocols] : ['x402'],
      maxPrice: undefined,
      minPrice: undefined,
      dynamicPrice: false,
      tickCost: undefined,
      unitType: undefined,
      payTo: undefined,
      bodySchema: undefined,
      querySchema: undefined,
      outputSchema: undefined,
      inputExample: undefined,
      hasInputExample: false,
      outputExample: undefined,
      hasOutputExample: false,
      description: undefined,
      path: undefined,
      method: 'POST',
      apiKeyResolver: undefined,
      providerName: undefined,
      providerConfig: undefined,
      validateFn: undefined,
      settlement: undefined,
      mppInfo: undefined,
    };
  }

  private fork(): this {
    const next = new RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, IsDynamic>(
      this.#s.key,
      this.#s.registry,
      this.#s.deps,
    ) as unknown as this;
    next.#s = { ...this.#s, protocols: [...this.#s.protocols] };
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
    const { pricing, resolvedOptions } = resolvePaidArgs(this.#s.key, pricingOrOptions, options);

    if (this.#s.authMode === 'unprotected') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .unprotected() and .paid() on the same route.`,
      );
    }
    if (this.#s.pricing !== undefined) {
      throw new Error(
        `route '${this.#s.key}': Cannot call .paid() more than once on the same route.`,
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
    next.#s.authMode = 'paid';
    next.#s.pricing = pricing;
    if (resolvedOptions?.protocols) {
      next.#s.protocols = [...resolvedOptions.protocols];
    } else if (next.#s.protocols.length === 0) {
      next.#s.protocols = ['x402'];
    }
    if (resolvedOptions?.maxPrice) next.#s.maxPrice = resolvedOptions.maxPrice;
    if (resolvedOptions?.minPrice) next.#s.minPrice = resolvedOptions.minPrice;
    if (resolvedOptions?.payTo) next.#s.payTo = resolvedOptions.payTo;
    if (resolvedOptions?.mpp) next.#s.mppInfo = resolvedOptions.mpp;
    if (resolvedOptions?.dynamic) next.#s.dynamicPrice = true;
    if (resolvedOptions?.tickCost) next.#s.tickCost = resolvedOptions.tickCost;
    if (resolvedOptions?.unitType) next.#s.unitType = resolvedOptions.unitType;

    if (typeof pricing === 'object' && 'tiers' in pricing) {
      if (next.#s.dynamicPrice) {
        throw new Error(
          `route '${this.#s.key}': .paid({ dynamic: true }) is incompatible with tiered pricing`,
        );
      }
      for (const [tierKey, tierConfig] of Object.entries(pricing.tiers)) {
        if (!tierKey) {
          throw new Error(`route '${this.#s.key}': tier key cannot be empty`);
        }
        if (!isPositiveDecimal(tierConfig.price)) {
          throw new Error(
            `route '${this.#s.key}': tier '${tierKey}' price '${tierConfig.price}' must be a positive decimal string`,
          );
        }
      }
    }
    if (resolvedOptions?.maxPrice !== undefined && !isPositiveDecimal(resolvedOptions.maxPrice)) {
      throw new Error(
        `route '${this.#s.key}': maxPrice '${resolvedOptions.maxPrice}' must be a positive decimal string`,
      );
    }
    if (resolvedOptions?.tickCost !== undefined && !isPositiveDecimal(resolvedOptions.tickCost)) {
      throw new Error(
        `route '${this.#s.key}': tickCost '${resolvedOptions.tickCost}' must be a positive decimal string`,
      );
    }
    if (next.#s.dynamicPrice && !next.#s.maxPrice) {
      throw new Error(`route '${this.#s.key}': .paid({ dynamic: true }) requires maxPrice`);
    }
    if (next.#s.dynamicPrice && !next.#s.tickCost) {
      throw new Error(`route '${this.#s.key}': .paid({ dynamic: true }) requires tickCost`);
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
    if (this.#s.authMode === 'unprotected') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .unprotected() and .siwx() on the same route.`,
      );
    }

    if (this.#s.apiKeyResolver) {
      throw new Error(
        `route '${this.#s.key}': Combining .siwx() and .apiKey() is not supported on the same route.`,
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
    next.#s.siwxEnabled = true;

    if (next.#s.authMode === 'paid' || next.#s.pricing) {
      next.#s.authMode = 'paid';
      if (next.#s.protocols.length === 0) next.#s.protocols = ['x402'];
      return next;
    }

    next.#s.authMode = 'siwx';
    next.#s.protocols = [];
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
    if (this.#s.siwxEnabled) {
      throw new Error(
        `route '${this.#s.key}': Combining .apiKey() and .siwx() is not supported on the same route.`,
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
    next.#s.authMode = 'apiKey';
    next.#s.apiKeyResolver = resolver;
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
    if (this.#s.authMode && this.#s.authMode !== 'unprotected') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .unprotected() and .${this.#s.authMode}() on the same route.`,
      );
    }

    if (this.#s.pricing) {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .unprotected() and .paid() on the same route.`,
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
    next.#s.authMode = 'unprotected';
    next.#s.protocols = [];
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
    next.#s.providerName = name;
    next.#s.providerConfig = config ?? {};
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
    next.#s.bodySchema = schema;
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
    next.#s.querySchema = schema;
    next.#s.method = 'GET';
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
    next.#s.outputSchema = schema;
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
    next.#s.inputExample = example;
    next.#s.hasInputExample = true;
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
    next.#s.outputExample = example;
    next.#s.hasOutputExample = true;
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
    next.#s.description = text;
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
    next.#s.path = p;
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
    next.#s.method = m;
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
    next.#s.validateFn = fn;
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
    next.#s.settlement = lifecycle;
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
    if (!this.#s.authMode) {
      throw new Error(
        `route '${this.#s.key}': Select an auth mode: .paid(pricing), .siwx(), .apiKey(resolver), or .unprotected()`,
      );
    }
    if (this.#s.validateFn && !this.#s.bodySchema) {
      throw new Error(
        `route '${this.#s.key}': .validate() requires .body() — validation runs on parsed body`,
      );
    }
    if (this.#s.settlement && !this.#s.pricing) {
      throw new Error(`route '${this.#s.key}': .settlement() requires a paid route`);
    }
    if (this.#s.dynamicPrice && this.#s.protocols.includes('x402')) {
      const hasUpto = this.#s.deps.x402Accepts.some((accept) => accept.scheme === 'upto');
      if (!hasUpto) {
        throw new Error(
          `route '${this.#s.key}': .paid({ dynamic: true }) on an x402 route requires an 'upto' accept on at least one configured network. ` +
            `Add { scheme: 'upto', network, asset } to RouterConfig.x402.accepts.`,
        );
      }
    }
    if (this.#s.dynamicPrice && this.#s.protocols.includes('mpp')) {
      if (!this.#s.deps.mppSessionConfig) {
        throw new Error(
          `route '${this.#s.key}': .paid({ dynamic: true }) on an MPP route requires session mode. ` +
            `Set RouterConfig.mpp.session = {} and provide mpp.operatorKey.`,
        );
      }
    }
    if (streaming && !this.#s.dynamicPrice) {
      throw new Error(
        `route '${this.#s.key}': .stream() requires .paid({ dynamic: true }) — ` +
          `static/free routes can't meter per-chunk billing.`,
      );
    }

    validateExamples(
      this.#s.key,
      this.#s.bodySchema,
      this.#s.querySchema,
      this.#s.outputSchema,
      this.#s.inputExample,
      this.#s.hasInputExample,
      this.#s.outputExample,
      this.#s.hasOutputExample,
    );

    const entry: RouteEntry = {
      key: this.#s.key,
      authMode: this.#s.authMode!,
      siwxEnabled: this.#s.siwxEnabled,
      pricing: this.#s.pricing,
      dynamicPrice: this.#s.dynamicPrice ? true : undefined,
      streaming: streaming ? true : undefined,
      protocols: this.#s.protocols,
      bodySchema: this.#s.bodySchema,
      querySchema: this.#s.querySchema,
      outputSchema: this.#s.outputSchema,
      inputExample: this.#s.hasInputExample ? this.#s.inputExample : undefined,
      outputExample: this.#s.hasOutputExample ? this.#s.outputExample : undefined,
      description: this.#s.description,
      path: this.#s.path,
      method: this.#s.method,
      maxPrice: this.#s.maxPrice,
      minPrice: this.#s.minPrice,
      payTo: this.#s.payTo,
      apiKeyResolver: this.#s.apiKeyResolver,
      providerName: this.#s.providerName,
      providerConfig: this.#s.providerConfig,
      validateFn: this.#s.validateFn as ((body: unknown) => void | Promise<void>) | undefined,
      settlement: this.#s.settlement as SettlementLifecycle | undefined,
      mppInfo: this.#s.mppInfo,
      tickCost: this.#s.tickCost,
      unitType: this.#s.unitType,
    };

    this.#s.registry.register(entry);

    return createRequestHandler(entry, handlerFn, this.#s.deps);
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
