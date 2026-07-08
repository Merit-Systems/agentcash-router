import type { ZodType, output as ZodOutput } from 'zod';
import type {
  HandlerContext,
  StreamingHandlerContext,
  UptoHandlerContext,
  RouteEntry,
  PricingConfig,
  PaidOptions,
  PaidArg,
  UpToOptions,
  SessionOptions,
  MeteredOptions,
  AuthMode,
  ProtocolType,
  ProviderConfig,
  MppProtocolInfo,
  TierConfig,
  JsonObject,
  JsonValue,
  SettlementLifecycle,
  PayToConfig,
  CheckoutSessionFn,
} from './types.js';
import type { RouteRegistry } from './registry.js';
import type { RouterDeps, RouteHandler } from './pipeline/orchestrate.js';
import { createRequestHandler } from './pipeline/orchestrate.js';
import { RouteDefinitionError } from './types.js';
import { isPositiveDecimal } from './pricing/format.js';
import { normalizePath } from './path-params.js';
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

/**
 * Pricing-mode discriminator threaded through the builder. `'none'` until a
 * pricing method is chained; then `'exact'` (`.paid()`), `'upto'`, or
 * `'metered'` (`.session()` / deprecated `.metered()`). Gates repeat pricing
 * calls and picks the handler shape.
 */
export type BillingMode = 'none' | 'exact' | 'upto' | 'metered';

/**
 * Identity-mode discriminator threaded through the builder. `'none'` until an
 * identity method is chained; then `'siwx'`, `'apiKey'`, or `'open'`
 * (`.unprotected()`). Gates the mutually-exclusive combinations at compile
 * time, mirroring the registration-time throws.
 */
export type IdentMode = 'none' | 'siwx' | 'apiKey' | 'open';

/** Resolves to `TSelf` when a pricing method may be chained, else a `RouteError`. Mirrors the runtime guards in `applyPaid`. */
type PricingGate<
  TSelf,
  Ident extends IdentMode,
  Bill extends BillingMode,
  M extends string,
> = Ident extends 'open'
  ? RouteError<`Cannot combine .unprotected() and .${M}() on the same route`>
  : Bill extends 'none'
    ? TSelf
    : RouteError<'Cannot combine .paid(), .upTo(), and .session() — pick one pricing mode'>;

type HandlerArg<
  TBody,
  TQuery,
  Ident extends IdentMode,
  NeedsBody extends boolean,
  HasBody extends boolean,
  Bill extends BillingMode,
> = [Ident, Bill] extends ['none', 'none']
  ? RouteError<'Pick an auth mode first: .paid(...), .upTo(...), .session(...), .siwx(), .apiKey(...), or .unprotected()'>
  : [NeedsBody, HasBody] extends [true, false]
    ? RouteError<'Call .body(schema) — body-derived/tiered pricing reads the parsed body'>
    : Bill extends 'upto'
      ? UptoHandlerFn<TBody, TQuery>
      : RequestHandlerFn<TBody, TQuery>;

type StreamArg<
  TBody,
  TQuery,
  Ident extends IdentMode,
  NeedsBody extends boolean,
  HasBody extends boolean,
  Bill extends BillingMode,
> = [Ident, Bill] extends ['none', 'none']
  ? RouteError<'Pick an auth mode first: .session({ ... }) — streaming requires session pricing'>
  : Bill extends 'metered'
    ? [NeedsBody, HasBody] extends [true, false]
      ? RouteError<'Call .body(schema) — session pricing reads the parsed body'>
      : StreamingHandlerFn<TBody, TQuery>
    : Bill extends 'upto'
      ? RouteError<'Streaming is not supported on .upTo() — use .session() on MPP for per-yield billing'>
      : RouteError<'Streaming requires .session({ unitCost, maxPrice }) — static/free routes cannot meter per-chunk billing'>;

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
  mppInfo: MppProtocolInfo | undefined;
  hasCheckout: boolean;
  checkoutSession: CheckoutSessionFn | undefined;
};

export interface RouteBuilderDefaults {
  protocols?: ProtocolType[];
}

export class RouteBuilder<
  TBody = undefined,
  TQuery = undefined,
  TOutput = undefined,
  Ident extends IdentMode = 'none',
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
      mppInfo: undefined,
      hasCheckout: false,
      checkoutSession: undefined,
    };
  }

  private fork(): this {
    const next = new RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>(
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
    this: PricingGate<
      RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
      Ident,
      Bill,
      'paid'
    >,
    price: string,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'exact'>;
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
    this: PricingGate<
      RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
      Ident,
      Bill,
      'paid'
    >,
    fn: (body: TBodyIn) => string | Promise<string>,
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, True, HasBody, 'exact'>;
  /**
   * Options-object form of fixed or body-derived pricing. Pass exactly one of:
   *
   * - `{ price }` — fixed price (object form of the string sugar).
   * - `{ field, tiers, default? }` — pick a tier from `body[field]`.
   *
   * Common knobs (`protocols`, `maxPrice`, `minPrice`, `payTo`, `mpp`, `checkout`,
   * `checkoutSession`) live alongside the pricing shape. Set `mpp.settleBeforeHandler`
   * on slow upstream routes so MPP transaction (pull) credentials broadcast at verify.
   * For auto-priced routes from `RouterConfig.prices`, chain `.mpp({ settleBeforeHandler: true })`.
   *
   * @example
   * ```ts
   * router.route('upload')
   *   .paid({ field: 'size', tiers: { sm: { price: '0.01' }, lg: { price: '0.10' } } })
   *   .body(schema).handler(handler);
   * ```
   */
  paid<T extends PaidArg>(
    this: PricingGate<
      RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
      Ident,
      Bill,
      'paid'
    >,
    arg: T,
  ): RouteBuilder<
    TBody,
    TQuery,
    TOutput,
    Ident,
    T extends { tiers: Record<string, TierConfig> } ? True : False,
    HasBody,
    'exact'
  >;
  paid(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
    arg: string | PaidArg | ((body: never) => string | Promise<string>),
    options?: PaidOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, boolean, HasBody, 'exact'> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    return self.applyPaid(normalizePaidArg(self.#s.key, arg, options), 'paid') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      boolean,
      HasBody,
      'exact'
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
    this: PricingGate<
      RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
      Ident,
      Bill,
      'upTo'
    >,
    arg: string | UpToOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'upto'>;
  upTo(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
    arg: string | UpToOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'upto'> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    return self.applyPaid(normalizeUpToArg(self.#s.key, arg), 'upTo') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      False,
      HasBody,
      'upto'
    >;
  }

  /**
   * MPP-only per-unit billing over a payment channel (the MPP `session`
   * intent). `.handler()` bills exactly `unitCost` per request; `.stream()`
   * calls `charge()` (no-arg) per yield, settling per unit up to `maxPrice`.
   * Requires `RouterConfig.mpp.session`.
   *
   * @example
   * ```ts
   * router.route('llm/stream')
   *   .session({ unitCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
   *   .stream(async function* ({ charge }) { await charge(); yield 'hi'; });
   * ```
   */
  session(
    this: Ident extends 'siwx'
      ? RouteError<'Cannot combine .siwx() and .session() — per-unit MPP billing has no entitlement model'>
      : PricingGate<
          RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
          Ident,
          Bill,
          'session'
        >,
    options: SessionOptions | MeteredOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'metered'>;
  session(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
    options: SessionOptions | MeteredOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'metered'> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    return self.applyPaid(normalizeSessionArg(self.#s.key, options), 'session') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      False,
      HasBody,
      'metered'
    >;
  }

  /**
   * @deprecated Renamed to {@link session} — the MPP intent is named `session`
   * (and `tickCost` is now `unitCost`). This alias behaves identically and
   * will be removed in a future release.
   */
  metered(
    this: Ident extends 'siwx'
      ? RouteError<'Cannot combine .siwx() and .session() — per-unit MPP billing has no entitlement model'>
      : PricingGate<
          RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
          Ident,
          Bill,
          'metered'
        >,
    options: MeteredOptions | SessionOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'metered'>;
  metered(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
    options: MeteredOptions | SessionOptions,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, False, HasBody, 'metered'> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    return self.applyPaid(normalizeSessionArg(self.#s.key, options), 'metered') as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      False,
      HasBody,
      'metered'
    >;
  }

  private applyPaid(
    normalized: NormalizedPaidArg,
    method: 'paid' | 'upTo' | 'session' | 'metered',
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, boolean, HasBody, BillingMode> {
    const { pricing, resolvedOptions, billing, tickCost, unitType, maxPrice } = normalized;

    if (this.#s.authMode === 'unprotected') {
      throw new RouteDefinitionError(
        this.#s.key,
        `Cannot combine .unprotected() and .${method}() on the same route.`,
      );
    }
    if (this.#s.pricing !== undefined) {
      throw new RouteDefinitionError(
        this.#s.key,
        `Cannot combine .paid(), .upTo(), and .session() — pick one pricing mode.`,
      );
    }
    if (this.#s.siwxEnabled && billing === 'metered') {
      throw new RouteDefinitionError(
        this.#s.key,
        `Cannot combine .siwx() and .session() — per-unit MPP billing has no entitlement model. ` +
          `Use .paid() or .upTo() with .siwx(), or drop .siwx() for session routes.`,
      );
    }

    const next = this.fork() as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      boolean,
      HasBody,
      BillingMode
    >;
    next.#s.authMode = 'paid';
    next.#s.pricing = pricing;
    if (billing === 'upto') {
      // .upTo() is x402-only — handler-computed billing settles a single x402 payment.
      if (resolvedOptions.protocols?.some((p) => p !== 'x402')) {
        throw new RouteDefinitionError(
          this.#s.key,
          `.upTo() is x402-only — remove the conflicting protocols override.`,
        );
      }
      next.#s.protocols = ['x402'];
    } else if (billing === 'metered') {
      // .session() is MPP-only — per-unit billing runs over an MPP payment channel.
      if (resolvedOptions.protocols?.some((p) => p !== 'mpp')) {
        throw new RouteDefinitionError(
          this.#s.key,
          `.session() is MPP-only — remove the conflicting protocols override.`,
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
    if (resolvedOptions.mpp) {
      next.#s.mppInfo = { ...next.#s.mppInfo, ...resolvedOptions.mpp };
    }
    if (resolvedOptions.checkout || resolvedOptions.checkoutSession) next.#s.hasCheckout = true;
    if (resolvedOptions.checkoutSession) next.#s.checkoutSession = resolvedOptions.checkoutSession;
    next.#s.billing = billing;
    if (tickCost) next.#s.tickCost = tickCost;
    if (unitType) next.#s.unitType = unitType;

    if (typeof pricing === 'object' && 'tiers' in pricing) {
      for (const [tierKey, tierConfig] of Object.entries(pricing.tiers)) {
        if (!tierKey) {
          throw new RouteDefinitionError(this.#s.key, `tier key cannot be empty`);
        }
        if (!isPositiveDecimal(tierConfig.price)) {
          throw new RouteDefinitionError(
            this.#s.key,
            `tier '${tierKey}' price '${tierConfig.price}' must be a positive decimal string`,
          );
        }
      }
    }
    if (billing === 'exact' && typeof pricing === 'string' && !isPositiveDecimal(pricing)) {
      throw new RouteDefinitionError(
        this.#s.key,
        `price '${pricing}' must be a positive decimal string`,
      );
    }
    if (typeof pricing === 'function' && next.#s.maxPrice === undefined) {
      throw new RouteDefinitionError(
        this.#s.key,
        `dynamic pricing requires maxPrice — without it, bare probes would advertise a $0 challenge`,
      );
    }
    if (next.#s.maxPrice !== undefined && !isPositiveDecimal(next.#s.maxPrice)) {
      throw new RouteDefinitionError(
        this.#s.key,
        `maxPrice '${next.#s.maxPrice}' must be a positive decimal string`,
      );
    }
    if (next.#s.minPrice !== undefined && !isPositiveDecimal(next.#s.minPrice)) {
      throw new RouteDefinitionError(
        this.#s.key,
        `minPrice '${next.#s.minPrice}' must be a positive decimal string`,
      );
    }
    if (next.#s.tickCost !== undefined && !isPositiveDecimal(next.#s.tickCost)) {
      throw new RouteDefinitionError(
        this.#s.key,
        `unitCost '${next.#s.tickCost}' must be a positive decimal string`,
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
   * Mutually exclusive with `.session()`.
   *
   * @example
   * ```ts
   * router.route('profile').siwx().handler(async ({ wallet }) => getProfile(wallet));
   * router.route('inbox').paid('0.01').siwx().handler(async ({ wallet }) => getInbox(wallet));
   * ```
   */
  siwx(
    this: Ident extends 'open'
      ? RouteError<'Cannot combine .unprotected() and .siwx() on the same route'>
      : Ident extends 'apiKey'
        ? RouteError<'Combining .siwx() and .apiKey() is not supported on the same route'>
        : Bill extends 'metered'
          ? RouteError<'Cannot combine .session() and .siwx() — per-unit MPP billing has no entitlement model'>
          : RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'siwx', NeedsBody, HasBody, Bill>;
  siwx(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'siwx', NeedsBody, HasBody, Bill> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    if (self.#s.authMode === 'unprotected') {
      throw new RouteDefinitionError(
        self.#s.key,
        `Cannot combine .unprotected() and .siwx() on the same route.`,
      );
    }

    if (self.#s.apiKeyResolver) {
      throw new RouteDefinitionError(
        self.#s.key,
        `Combining .siwx() and .apiKey() is not supported on the same route.`,
      );
    }

    if (self.#s.billing === 'metered') {
      throw new RouteDefinitionError(
        self.#s.key,
        `Cannot combine .session() and .siwx() — per-unit MPP billing has no entitlement model. ` +
          `Use .paid() or .upTo() with .siwx(), or drop .siwx() for session routes.`,
      );
    }

    const next = self.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      'siwx',
      NeedsBody,
      HasBody,
      Bill
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
    this: Ident extends 'open'
      ? RouteError<'Cannot combine .unprotected() and .apiKey() on the same route'>
      : Ident extends 'siwx'
        ? RouteError<'Combining .apiKey() and .siwx() is not supported on the same route'>
        : RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>,
    resolver: (key: string) => unknown | Promise<unknown>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'apiKey', NeedsBody, HasBody, Bill>;
  apiKey(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
    resolver: (key: string) => unknown | Promise<unknown>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'apiKey', NeedsBody, HasBody, Bill> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    if (self.#s.authMode === 'unprotected') {
      throw new RouteDefinitionError(
        self.#s.key,
        `Cannot combine .unprotected() and .apiKey() on the same route.`,
      );
    }
    if (self.#s.siwxEnabled) {
      throw new RouteDefinitionError(
        self.#s.key,
        `Combining .apiKey() and .siwx() is not supported on the same route.`,
      );
    }
    const next = self.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      'apiKey',
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
  unprotected(
    this: Bill extends 'none'
      ? Ident extends 'siwx'
        ? RouteError<'Cannot combine .unprotected() and .siwx() on the same route'>
        : Ident extends 'apiKey'
          ? RouteError<'Cannot combine .unprotected() and .apiKey() on the same route'>
          : RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      : RouteError<'Cannot combine .unprotected() and a pricing mode on the same route'>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'open', NeedsBody, HasBody, Bill>;
  unprotected(
    this:
      | RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>
      | RouteError<string>,
  ): RouteBuilder<TBody, TQuery, TOutput, 'open', NeedsBody, HasBody, Bill> {
    const self = this as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
    if (self.#s.authMode && self.#s.authMode !== 'unprotected') {
      throw new RouteDefinitionError(
        self.#s.key,
        `Cannot combine .unprotected() and .${self.#s.authMode}() on the same route.`,
      );
    }

    if (self.#s.pricing) {
      throw new RouteDefinitionError(
        self.#s.key,
        `Cannot combine .unprotected() and .paid() on the same route.`,
      );
    }

    const next = self.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      'open',
      NeedsBody,
      HasBody,
      Bill
    >;
    next.#s.authMode = 'unprotected';
    next.#s.protocols = [];
    return next;
  }

  /**
   * Tag the route with an upstream provider for discovery and provider-side
   * monitoring. The provider name and config surface in OpenAPI discovery
   * output.
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
  // Generic over the schema (not `ZodType<T>`) so inference binds the schema
  // type directly instead of structurally walking zod's internals to extract
  // the output position — measurably shallower instantiation stacks in
  // consumer route files. Same inferred body type via the lazy `ZodOutput<S>`.
  body<S extends ZodType>(
    schema: S,
  ): RouteBuilder<ZodOutput<S>, TQuery, TOutput, Ident, NeedsBody, True, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      ZodOutput<S>,
      TQuery,
      TOutput,
      Ident,
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
  query<S extends ZodType>(
    schema: S,
  ): RouteBuilder<TBody, ZodOutput<S>, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      ZodOutput<S>,
      TOutput,
      Ident,
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
  output<S extends ZodType>(
    schema: S,
  ): RouteBuilder<TBody, TQuery, ZodOutput<S>, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      ZodOutput<S>,
      Ident,
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
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
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
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork() as unknown as RouteBuilder<
      TBody,
      TQuery,
      TOutput,
      Ident,
      NeedsBody,
      HasBody,
      Bill
    >;
    next.#s.outputExample = example;
    next.#s.hasOutputExample = true;
    return next;
  }

  /**
   * Set a human-readable summary of the route. Surfaces in OpenAPI and
   * `llms.txt` discovery output.
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
   * Override the URL path the route is mounted and advertised under. Defaults
   * to the registry key passed to `.route()`. Normalized like `.route()` paths
   * (leading slashes and an `api/` prefix stripped) so both produce the same
   * mounted URL.
   *
   * @example
   * ```ts
   * router.route('search').path('/v2/search').handler(handler);
   * ```
   */
  path(p: string): this {
    const next = this.fork();
    next.#s.path = normalizePath(p);
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
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork();
    next.#s.validateFn = fn;
    return next as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
  }

  /**
   * Override MPP protocol metadata and per-route MPP settlement options.
   * Merges with any `mpp` options passed to `.paid()`. Use on auto-priced routes
   * (from `RouterConfig.prices`) when you cannot call `.paid()` again.
   *
   * @example
   * ```ts
   * router.route('exa/answer')
   *   .mpp({ settleBeforeHandler: true })
   *   .body(schema)
   *   .handler(handler);
   * ```
   */
  mpp(
    info: MppProtocolInfo,
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork();
    next.#s.mppInfo = { ...this.#s.mppInfo, ...info };
    return next as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
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
  ): RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill> {
    const next = this.fork();
    next.#s.settlement = { ...this.#s.settlement, ...lifecycle };
    return next as RouteBuilder<TBody, TQuery, TOutput, Ident, NeedsBody, HasBody, Bill>;
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
    fn: HandlerArg<TBody, TQuery, Ident, NeedsBody, HasBody, Bill>,
  ): (request: Request) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, false);
  }

  /**
   * Register a streaming handler (`async function*`) and return the Next.js
   * route function — the SSE transport of an MPP session. Each `charge()`
   * call bills one unit (`unitCost` USDC) up to `maxPrice`; requires
   * `.session({ ... })` and MPP session mode.
   *
   * @example
   * ```ts
   * export const POST = router
   *   .route('llm/stream')
   *   .session({ unitCost: '0.0001', maxPrice: '0.05', unitType: 'token' })
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
    fn: StreamArg<TBody, TQuery, Ident, NeedsBody, HasBody, Bill>,
  ): (request: Request) => Promise<Response> {
    return this.register(fn as unknown as RouteHandler, true);
  }

  private register(
    handlerFn: RouteHandler,
    streaming: boolean,
  ): (request: Request) => Promise<Response> {
    if (!this.#s.authMode) {
      throw new RouteDefinitionError(
        this.#s.key,
        `Select an auth mode: .paid(pricing), .upTo(maxPrice), .session(options), .siwx(), .apiKey(resolver), or .unprotected()`,
      );
    }
    if (this.#s.validateFn && !this.#s.bodySchema) {
      throw new RouteDefinitionError(
        this.#s.key,
        `.validate() requires .body() — validation runs on parsed body`,
      );
    }
    if (this.#s.settlement && !this.#s.pricing) {
      throw new RouteDefinitionError(this.#s.key, `.settlement() requires a paid route`);
    }
    if (this.#s.mppInfo?.settleBeforeHandler) {
      if (!this.#s.pricing) {
        throw new RouteDefinitionError(
          this.#s.key,
          `mpp.settleBeforeHandler requires a paid route`,
        );
      }
      if (this.#s.billing !== 'exact') {
        throw new RouteDefinitionError(
          this.#s.key,
          `mpp.settleBeforeHandler is only supported on .paid() routes`,
        );
      }
      if (this.#s.settlement?.beforeSettle) {
        throw new RouteDefinitionError(
          this.#s.key,
          `mpp.settleBeforeHandler is incompatible with .settlement({ beforeSettle }) — MPP payment is already broadcast before the handler runs`,
        );
      }
    }
    if (this.#s.billing === 'upto') {
      const hasUpto = this.#s.deps.x402Accepts.some((accept) => accept.scheme === 'upto');
      if (!hasUpto) {
        throw new RouteDefinitionError(
          this.#s.key,
          `.upTo() requires an 'upto' accept on at least one configured network. ` +
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
        throw new RouteDefinitionError(
          this.#s.key,
          `.paid() needs a non-'upto' x402 accept — an 'upto'-only accept ` +
            `list cannot serve a fixed-price route. Add { scheme: 'exact', network } to ` +
            `RouterConfig.x402.accepts, or use .upTo() for handler-computed billing.`,
        );
      }
    }
    if (this.#s.billing === 'metered') {
      if (!this.#s.deps.mppSessionConfig) {
        throw new RouteDefinitionError(
          this.#s.key,
          `.session() requires MPP session mode. ` +
            `Set RouterConfig.mpp.session = {} and provide mpp.operatorKey.`,
        );
      }
    }
    if (streaming && this.#s.billing !== 'metered') {
      throw new RouteDefinitionError(
        this.#s.key,
        `.stream() requires .session() — ` +
          `static/free/upto routes can't meter per-chunk billing.`,
      );
    }
    if (
      this.#s.description !== undefined &&
      this.#s.description.length > MAX_X402_DESCRIPTION_LENGTH &&
      this.#s.pricing !== undefined &&
      this.#s.protocols.includes('x402')
    ) {
      throw new RouteDefinitionError(
        this.#s.key,
        `.description() is ${this.#s.description.length} chars; ` +
          `must be ≤ ${MAX_X402_DESCRIPTION_LENGTH} chars — the CDP x402 facilitator rejects ` +
          `payments whose 402 challenge resource.description exceeds ~500 chars.`,
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
      mppInfo: this.#s.mppInfo,
      hasCheckout: this.#s.hasCheckout ? true : undefined,
      checkoutSession: this.#s.checkoutSession,
      tickCost: this.#s.tickCost,
      unitType: this.#s.unitType,
    };

    const requestHandler = createRequestHandler(entry, handlerFn, this.#s.deps);
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

  throw new RouteDefinitionError(
    routeKey,
    `.paid() requires one of: a price string, a (body) => string function, { price }, or { field, tiers }. ` +
      `For handler-computed billing use .upTo(); for per-unit billing use .session().`,
  );
}

function normalizeUpToArg(routeKey: string, arg: string | UpToOptions): NormalizedPaidArg {
  const options: UpToOptions = typeof arg === 'string' ? { maxPrice: arg } : arg;
  if (!options.maxPrice) {
    throw new RouteDefinitionError(routeKey, `.upTo() requires maxPrice`);
  }
  return {
    pricing: options.maxPrice,
    resolvedOptions: options,
    billing: 'upto',
    unitType: options.unitType,
    maxPrice: options.maxPrice,
  };
}

function normalizeSessionArg(
  routeKey: string,
  options: SessionOptions | MeteredOptions,
): NormalizedPaidArg {
  if (!options.maxPrice) {
    throw new RouteDefinitionError(routeKey, `.session() requires maxPrice`);
  }
  // `tickCost` is the deprecated pre-`.session()` name for `unitCost`.
  const unitCost = options.unitCost ?? options.tickCost;
  if (!unitCost) {
    throw new RouteDefinitionError(routeKey, `.session() requires unitCost`);
  }
  return {
    pricing: options.maxPrice,
    resolvedOptions: options,
    billing: 'metered',
    tickCost: unitCost,
    unitType: options.unitType,
    maxPrice: options.maxPrice,
  };
}
