import type { ZodType } from 'zod';
import type {
  HandlerContext,
  StreamingHandlerContext,
  UptoHandlerContext,
  RouteEntry,
  PricingConfig,
  PaidOptions,
  PaidArg,
  UpToOptions,
  MeteredOptions,
  AuthMode,
  ProtocolType,
  ProviderConfig,
  MppProtocolInfo,
  TierConfig,
  JsonObject,
  JsonValue,
  NextStepConfig,
  SettlementLifecycle,
  PayToConfig,
} from './types.js';
import type { RouteRegistry } from './registry.js';
import type { RouterDeps, RouteHandler, RouteRouting } from './pipeline/orchestrate.js';
import { createRequestHandler } from './pipeline/orchestrate.js';
import { isPositiveDecimal } from './pricing/format.js';
import { validateExamples } from './validate-examples.js';

const MAX_X402_DESCRIPTION_LENGTH = 400;

type True = true;
type False = false;

declare const ROUTE_ERROR: unique symbol;
export interface RouteError<M extends string> {
  readonly [ROUTE_ERROR]: M;
}

type InputTypeFor<TBody, TQuery> = [TBody] extends [undefined]
  ? [TQuery] extends [undefined]
    ? never
    : TQuery
  : TBody;

type RequestHandlerFn<TBody, TQuery> = (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>;
type UptoHandlerFn<TBody, TQuery> = (ctx: UptoHandlerContext<TBody, TQuery>) => Promise<unknown>;

type StreamingHandlerFn<TBody, TQuery> = (
  ctx: StreamingHandlerContext<TBody, TQuery>,
) => AsyncIterable<unknown>;

/** Discriminator threaded through the builder so `.handler()` / `.stream()` can pick the right handler shape. */
export type BillingMode = 'none' | 'upto' | 'metered';

/** Handler result type seen by `.settlement()` / `.nextStep()`: `.output()`'s TOutput when declared, `unknown` otherwise. */
type ResultFor<TOutput> = [TOutput] extends [undefined] ? unknown : TOutput;

type HandlerArg<
  TBody,
  TQuery,
  HasAuth extends boolean,
  NeedsBody extends boolean,
  HasBody extends boolean,
  Bill extends BillingMode,
> = HasAuth extends true
  ? [NeedsBody, HasBody] extends [true, false]
    ? RouteError<'Call .body(schema) — body-derived/tiered pricing reads the parsed body'>
    : Bill extends 'upto'
      ? UptoHandlerFn<TBody, TQuery>
      : RequestHandlerFn<TBody, TQuery>
  : RouteError<'Pick an auth mode first: .paid(...), .upTo(...), .metered(...), .siwx(), .apiKey(...), or .unprotected()'>;

type StreamArg<
  TBody,
  TQuery,
  HasAuth extends boolean,
  NeedsBody extends boolean,
  HasBody extends boolean,
  Bill extends BillingMode,
> = HasAuth extends true
  ? Bill extends 'metered'
    ? [NeedsBody, HasBody] extends [true, false]
      ? RouteError<'Call .body(schema) — metered pricing reads the parsed body'>
      : StreamingHandlerFn<TBody, TQuery>
    : Bill extends 'upto'
      ? RouteError<'Streaming is not supported on .upTo() — use .metered() on MPP for per-yield billing'>
      : RouteError<'Streaming requires .metered({ tickCost, maxPrice }) — static/free routes cannot meter per-chunk billing'>
  : RouteError<'Pick an auth mode first: .metered({ ... }) — streaming requires metered pricing'>;

type BuilderState<TBody> = {
  key: string;
  registry: RouteRegistry;
  deps: RouterDeps;
  authMode: AuthMode | null;
  pricing: PricingConfig | undefined;
  siwxEnabled: boolean;
  protocols: ProtocolType[];
  maxPrice: string | undefined;
  minPrice: string | undefined;
  billing: 'exact' | 'upto' | 'metered';
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
  nextSteps: NextStepConfig[];
  routing: RouteRouting | null;
  mppInfo: MppProtocolInfo | undefined;
};

export interface RouteBuilderDefaults {
  protocols?: ProtocolType[];
  /** Origin URL (no trailing slash) for resolving `.nextStep()` target URLs. */
  baseUrl?: string;
  /** Route mount prefix (no slashes). Used with `baseUrl` for `.nextStep()` URLs. @default 'api' */
  basePath?: string;
}

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  TOutput = undefined,
  HasAuth extends boolean = false,
  NeedsBody extends boolean = false,
  HasBody extends boolean = false,
  Bill extends BillingMode = 'none',
> {
  #s: BuilderState<TBody>;

  constructor(
    key: string,
    registry: RouteRegistry,
    deps: RouterDeps,
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
      billing: 'exact',
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
      nextSteps: [],
      routing: defaults?.baseUrl
        ? { registry, baseUrl: defaults.baseUrl, basePath: defaults.basePath ?? 'api' }
        : null,
      mppInfo: undefined,
    };
  }

  private fork(): this {
    const next = new RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill>(
      this.#s.key,
      this.#s.registry,
      this.#s.deps,
    ) as unknown as this;
    next.#s = { ...this.#s, protocols: [...this.#s.protocols] };
    return next;
  }

  /**
   * Fixed-price string sugar: `paid('0.01')` charges 0.01 USDC per request.
   *
   * @example
   * ```ts
   * router.route('search').paid('0.01').handler(handler);
   * ```
   */
  paid(
    price: string,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, 'none'>;
  /**
   * Compute the price from the parsed body before issuing the 402 challenge.
   * Throw an `HttpError` from the pricing function to reject the request
   * before payment is requested. Requires `.body(schema)`.
   *
   * @example
   * ```ts
   * router.route('llm')
   *   .paid((body) => `${body.tokens * 0.0001}`, { maxPrice: '5.00' })
   *   .body(schema)
   *   .handler(handler);
   * ```
   */
  paid<TBodyIn>(
    fn: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, True, HasBody, 'none'>;
  /**
   * Options-object form of fixed or body-derived pricing. Pass exactly one of:
   *
   * - `{ price }` — fixed price (object form of the string sugar).
   * - `{ field, tiers, default? }` — pick a tier from `body[field]`.
   *
   * Common knobs (`protocols`, `maxPrice`, `minPrice`, `payTo`, `mpp`) live
   * alongside the pricing shape. For handler-computed billing use `.upTo()`;
   * for per-tick billing use `.metered()`.
   *
   * @example
   * ```ts
   * router.route('upload')
   *   .paid({ field: 'size', tiers: { sm: { price: '0.01' }, lg: { price: '0.10' } } })
   *   .body(schema).handler(handler);
   * ```
   */
  paid<T extends PaidArg>(
    arg: T,
  ): RouteBuilder<
    TBody,
    TQuery,
    TOutput,
    True,
    T extends { tiers: Record<string, TierConfig> } ? True : False,
    HasBody,
    'none'
  >;
  paid(
    arg: string | PaidArg | ((body: never) => string | Promise<string>),
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, boolean, HasBody, 'none'> {
    return this.applyPaid(normalizePaidArg(this.#s.key, arg, options), 'paid') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      boolean,
      HasBody,
      'none'
    >;
  }

  /**
   * x402-only handler-computed billing. The handler receives `charge(amount)`
   * and the request settles once for the accumulated total, capped at
   * `maxPrice`. Requires an `'upto'` accept on at least one configured network.
   * Pass a bare string as sugar for `{ maxPrice }`.
   *
   * @example
   * ```ts
   * router.route('llm')
   *   .upTo('0.05')
   *   .body(schema)
   *   .handler(async ({ body, charge }) => { await charge('0.001'); ... });
   * ```
   */
  upTo(
    arg: string | UpToOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, 'upto'> {
    return this.applyPaid(normalizeUpToArg(this.#s.key, arg), 'upTo') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      False,
      HasBody,
      'upto'
    >;
  }

  /**
   * MPP-only per-tick billing. `.handler()` bills exactly `tickCost`;
   * `.stream()` calls `charge()` (no-arg) per yield, settling per tick up to
   * `maxPrice`. Requires `RouterConfig.mpp.session`.
   *
   * @example
   * ```ts
   * router.route('llm/stream')
   *   .metered({ tickCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
   *   .stream(async function* ({ charge }) { await charge(); yield 'hi'; });
   * ```
   */
  metered(
    options: MeteredOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, 'metered'> {
    return this.applyPaid(normalizeMeteredArg(this.#s.key, options), 'metered') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      False,
      HasBody,
      'metered'
    >;
  }

  private applyPaid(
    normalized: NormalizedPaidArg,
    method: 'paid' | 'upTo' | 'metered',
  ): RouteBuilder<TBody, TQuery, TOutput, True, boolean, HasBody, BillingMode> {
    const { pricing, resolvedOptions, billing, tickCost, unitType, maxPrice } = normalized;

    if (this.#s.authMode === 'unprotected') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .unprotected() and .${method}() on the same route.`,
      );
    }
    if (this.#s.pricing !== undefined) {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .paid(), .upTo(), and .metered() — pick one pricing mode.`,
      );
    }
    if (this.#s.siwxEnabled && billing === 'metered') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .siwx() and .metered() — per-tick MPP billing has no entitlement model. ` +
          `Use .paid() or .upTo() with .siwx(), or drop .siwx() for metered routes.`,
      );
    }

    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      True,
      boolean,
      HasBody,
      BillingMode
    >;
    next.#s.authMode = 'paid';
    next.#s.pricing = pricing;
    if (billing === 'upto') {
      // .upTo() is x402-only — handler-computed billing settles a single x402 payment.
      if (resolvedOptions.protocols?.some((p) => p !== 'x402')) {
        throw new Error(
          `route '${this.#s.key}': .upTo() is x402-only — remove the conflicting protocols override.`,
        );
      }
      next.#s.protocols = ['x402'];
    } else if (billing === 'metered') {
      // .metered() is MPP-only — per-tick billing runs over an MPP payment channel.
      if (resolvedOptions.protocols?.some((p) => p !== 'mpp')) {
        throw new Error(
          `route '${this.#s.key}': .metered() is MPP-only — remove the conflicting protocols override.`,
        );
      }
      next.#s.protocols = ['mpp'];
    } else if (resolvedOptions.protocols) {
      next.#s.protocols = [...resolvedOptions.protocols];
    } else if (next.#s.protocols.length === 0) {
      next.#s.protocols = ['x402'];
    }
    if (resolvedOptions.maxPrice) next.#s.maxPrice = resolvedOptions.maxPrice;
    if (maxPrice) next.#s.maxPrice = maxPrice;
    if (resolvedOptions.minPrice) next.#s.minPrice = resolvedOptions.minPrice;
    if (resolvedOptions.payTo) next.#s.payTo = resolvedOptions.payTo;
    if (resolvedOptions.mpp) next.#s.mppInfo = resolvedOptions.mpp;
    next.#s.billing = billing;
    if (tickCost) next.#s.tickCost = tickCost;
    if (unitType) next.#s.unitType = unitType;

    if (typeof pricing === 'object' && 'tiers' in pricing) {
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
    if (billing === 'exact' && typeof pricing === 'string' && !isPositiveDecimal(pricing)) {
      throw new Error(
        `route '${this.#s.key}': price '${pricing}' must be a positive decimal string`,
      );
    }
    if (typeof pricing === 'function' && next.#s.maxPrice === undefined) {
      throw new Error(
        `route '${this.#s.key}': dynamic pricing requires maxPrice — without it, bare probes would advertise a $0 challenge`,
      );
    }
    if (next.#s.maxPrice !== undefined && !isPositiveDecimal(next.#s.maxPrice)) {
      throw new Error(
        `route '${this.#s.key}': maxPrice '${next.#s.maxPrice}' must be a positive decimal string`,
      );
    }
    if (next.#s.minPrice !== undefined && !isPositiveDecimal(next.#s.minPrice)) {
      throw new Error(
        `route '${this.#s.key}': minPrice '${next.#s.minPrice}' must be a positive decimal string`,
      );
    }
    if (next.#s.tickCost !== undefined && !isPositiveDecimal(next.#s.tickCost)) {
      throw new Error(
        `route '${this.#s.key}': tickCost '${next.#s.tickCost}' must be a positive decimal string`,
      );
    }

    return next;
  }

  /**
   * Require Sign-In-with-X wallet identity on this route — clients prove
   * control of a wallet via a signed challenge. Composes with `.paid()` and
   * `.upTo()` for pay-once-then-replay: the first request settles normally,
   * subsequent requests with a valid SIWX signature for the same wallet skip
   * payment (on `.upTo()`, `charge(amount)` becomes a no-op on the replay).
   * Mutually exclusive with `.metered()`.
   *
   * @example
   * ```ts
   * router.route('profile').siwx().handler(async ({ wallet }) => getProfile(wallet));
   * router.route('inbox').paid('0.01').siwx().handler(async ({ wallet }) => getInbox(wallet));
   * ```
   */
  siwx(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, Bill> {
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

    if (this.#s.billing === 'metered') {
      throw new Error(
        `route '${this.#s.key}': Cannot combine .metered() and .siwx() — per-tick MPP billing has no entitlement model. ` +
          `Use .paid() or .upTo() with .siwx(), or drop .siwx() for metered routes.`,
      );
    }

    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, Bill>;
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
  ): RouteBuilder<TBody, TQuery, TOutput, True, NeedsBody, HasBody, Bill> {
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
      Bill
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
  unprotected(): RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, Bill> {
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

    const next = this.fork() as RouteBuilder<TBody, TQuery, TOutput, True, False, HasBody, Bill>;
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
  body<T>(schema: ZodType<T>): RouteBuilder<T, TQuery, TOutput, HasAuth, NeedsBody, True, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      T,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      True,
      Bill
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
  query<T>(schema: ZodType<T>): RouteBuilder<TBody, T, TOutput, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      T,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      Bill
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
  output<T>(schema: ZodType<T>): RouteBuilder<TBody, TQuery, T, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      T,
      HasAuth,
      NeedsBody,
      HasBody,
      Bill
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
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      Bill
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
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      HasAuth,
      NeedsBody,
      HasBody,
      Bill
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
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork();
    next.#s.validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill>;
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
   *
   * `ctx.result` is typed from `.output()` when declared (chain `.output()`
   * before `.settlement()`); `unknown` otherwise.
   */
  settlement(
    lifecycle: SettlementLifecycle<TBody, ResultFor<TOutput>>,
  ): RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill> {
    const next = this.fork();
    next.#s.settlement = lifecycle as SettlementLifecycle<TBody>;
    return next as RouteBuilder<TBody, TQuery, TOutput, HasAuth, NeedsBody, HasBody, Bill>;
  }

  /**
   * Declare a successor route, advertised to callers on success. Repeatable
   * for multiple successors. When the handler succeeds and returns a plain
   * JSON object, the router appends a reserved `next` array — each entry
   * carries the target's resolved URL plus its `method`, `auth`, and `price`
   * derived from the target's own route entry, so an agent knows what the
   * next call costs before making it. A handler-supplied `next` key always
   * wins. Target existence is validated by `registry.validate()` at
   * discovery time. The response body is the single chaining channel; the
   * only static trace is the map-level `## Workflows` summary in llms.txt.
   *
   * `args` / `when` receive the handler result typed from `.output()` when
   * declared (chain `.output()` first); exceptions they throw are reported
   * as warnings and skip the entry — they never break the response.
   *
   * @example
   * ```ts
   * .nextStep({
   *   route: 'jobs/{jobId}',
   *   args: (result) => ({ jobId: result.jobId }),
   *   when: (result) => result.status === 'pending',
   *   note: 'Poll every ~5s until status is "complete".',
   * })
   * ```
   */
  nextStep(step: NextStepConfig<ResultFor<TOutput>>): this {
    const next = this.fork();
    next.#s.nextSteps = [...this.#s.nextSteps, step as NextStepConfig];
    return next;
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
    fn: HandlerArg<TBody, TQuery, HasAuth, NeedsBody, HasBody, Bill>,
  ): (request: Request) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, false);
  }

  /**
   * Register a streaming handler (`async function*`) and return the Next.js
   * route function. Each `charge()` call bills one tick (`tickCost` USDC) up
   * to `maxPrice`; requires `.metered({ ... })` and MPP session mode.
   *
   * @example
   * ```ts
   * export const POST = router
   *   .route('llm/stream')
   *   .metered({ tickCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
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
    fn: StreamArg<TBody, TQuery, HasAuth, NeedsBody, HasBody, Bill>,
  ): (request: Request) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, true);
  }

  private register(
    handlerFn: RouteHandler,
    streaming: boolean,
  ): (request: Request) => Promise<Response> {
    if (!this.#s.authMode) {
      throw new Error(
        `route '${this.#s.key}': Select an auth mode: .paid(pricing), .upTo(maxPrice), .metered(options), .siwx(), .apiKey(resolver), or .unprotected()`,
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
    if (this.#s.billing === 'upto') {
      const hasUpto = this.#s.deps.x402Accepts.some((accept) => accept.scheme === 'upto');
      if (!hasUpto) {
        throw new Error(
          `route '${this.#s.key}': .upTo() requires an 'upto' accept on at least one configured network. ` +
            `Add { scheme: 'upto', network, asset } to RouterConfig.x402.accepts.`,
        );
      }
    }
    if (
      this.#s.pricing !== undefined &&
      this.#s.billing === 'exact' &&
      this.#s.protocols.includes('x402')
    ) {
      const hasExact = this.#s.deps.x402Accepts.some(
        (accept) => (accept.scheme ?? 'exact') !== 'upto',
      );
      if (!hasExact) {
        throw new Error(
          `route '${this.#s.key}': .paid() needs a non-'upto' x402 accept — an 'upto'-only accept ` +
            `list cannot serve a fixed-price route. Add { scheme: 'exact', network } to ` +
            `RouterConfig.x402.accepts, or use .upTo() for handler-computed billing.`,
        );
      }
    }
    if (this.#s.billing === 'metered') {
      if (!this.#s.deps.mppSessionConfig) {
        throw new Error(
          `route '${this.#s.key}': .metered() requires MPP session mode. ` +
            `Set RouterConfig.mpp.session = {} and provide mpp.operatorKey.`,
        );
      }
    }
    if (streaming && this.#s.billing !== 'metered') {
      throw new Error(
        `route '${this.#s.key}': .stream() requires .metered() — ` +
          `static/free/upto routes can't meter per-chunk billing.`,
      );
    }
    if (
      this.#s.description !== undefined &&
      this.#s.description.length > MAX_X402_DESCRIPTION_LENGTH &&
      this.#s.pricing !== undefined &&
      this.#s.protocols.includes('x402')
    ) {
      throw new Error(
        `route '${this.#s.key}': .description() is ${this.#s.description.length} chars; ` +
          `must be ≤ ${MAX_X402_DESCRIPTION_LENGTH} chars — the CDP x402 facilitator rejects ` +
          `payments whose 402 challenge resource.description exceeds ~500 chars.`,
      );
    }

    validateExamples({
      key: this.#s.key,
      bodySchema: this.#s.bodySchema,
      querySchema: this.#s.querySchema,
      outputSchema: this.#s.outputSchema,
      inputExample: this.#s.inputExample,
      hasInputExample: this.#s.hasInputExample,
      outputExample: this.#s.outputExample,
      hasOutputExample: this.#s.hasOutputExample,
    });

    const entry: RouteEntry = {
      key: this.#s.key,
      authMode: this.#s.authMode!,
      siwxEnabled: this.#s.siwxEnabled,
      pricing: this.#s.pricing,
      billing: this.#s.billing,
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
      nextSteps: this.#s.nextSteps.length > 0 ? this.#s.nextSteps : undefined,
      mppInfo: this.#s.mppInfo,
      tickCost: this.#s.tickCost,
      unitType: this.#s.unitType,
    };

    const requestHandler = createRequestHandler(
      entry,
      handlerFn,
      this.#s.deps,
      this.#s.routing ?? undefined,
    );
    this.#s.registry.register(entry, requestHandler);

    return requestHandler;
  }
}

interface NormalizedPaidArg {
  pricing: PricingConfig;
  resolvedOptions: PaidOptions;
  billing: 'exact' | 'upto' | 'metered';
  tickCost?: string;
  unitType?: string;
  maxPrice?: string;
}

function normalizePaidArg(
  routeKey: string,
  arg: string | PaidArg | ((body: never) => string | Promise<string>),
  options?: PaidOptions,
): NormalizedPaidArg {
  if (typeof arg === 'string') {
    return { pricing: arg, resolvedOptions: options ?? {}, billing: 'exact' };
  }

  if (typeof arg === 'function') {
    return {
      pricing: arg as (body: unknown) => string | Promise<string>,
      resolvedOptions: options ?? {},
      billing: 'exact',
    };
  }

  if ('tiers' in arg && 'field' in arg) {
    return {
      pricing: { field: arg.field, tiers: arg.tiers, default: arg.default },
      resolvedOptions: arg,
      billing: 'exact',
    };
  }

  if ('price' in arg && typeof arg.price === 'string') {
    return { pricing: arg.price, resolvedOptions: arg, billing: 'exact' };
  }

  throw new Error(
    `route '${routeKey}': .paid() requires one of: a price string, a (body) => string function, { price }, or { field, tiers }. ` +
      `For handler-computed billing use .upTo(); for per-tick billing use .metered().`,
  );
}

function normalizeUpToArg(routeKey: string, arg: string | UpToOptions): NormalizedPaidArg {
  const options: UpToOptions = typeof arg === 'string' ? { maxPrice: arg } : arg;
  if (!options.maxPrice) {
    throw new Error(`route '${routeKey}': .upTo() requires maxPrice`);
  }
  return {
    pricing: options.maxPrice,
    resolvedOptions: options,
    billing: 'upto',
    unitType: options.unitType,
    maxPrice: options.maxPrice,
  };
}

function normalizeMeteredArg(routeKey: string, options: MeteredOptions): NormalizedPaidArg {
  if (!options.maxPrice) {
    throw new Error(`route '${routeKey}': .metered() requires maxPrice`);
  }
  if (!options.tickCost) {
    throw new Error(`route '${routeKey}': .metered() requires tickCost`);
  }
  return {
    pricing: options.maxPrice,
    resolvedOptions: options,
    billing: 'metered',
    tickCost: options.tickCost,
    unitType: options.unitType,
    maxPrice: options.maxPrice,
  };
}
