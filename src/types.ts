import type { FacilitatorConfig } from '@x402/core/http';
import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import type { Store } from 'mppx';
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

export type AlertLevel = 'info' | 'warn' | 'error' | 'critical';

export interface AlertEvent {
  level: AlertLevel;
  message: string;
  route: string;
  meta?: Record<string, unknown>;
}

export type AlertFn = (level: AlertLevel, message: string, meta?: Record<string, unknown>) => void;

// ---------------------------------------------------------------------------
// JSON values
// ---------------------------------------------------------------------------

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// x402 server interface
// ---------------------------------------------------------------------------

// Typed interface for x402ResourceServer using @x402/core's own types.
// Enforces correct method names, async signatures, and array vs single arg.
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';

export interface X402Server {
  initialize(): Promise<void>;

  buildPaymentRequirementsFromOptions(
    options: Array<{
      scheme: string;
      network: string;
      price: string | { asset: string; amount: string; extra?: Record<string, unknown> };
      payTo: string;
      maxTimeoutSeconds?: number;
      extra?: Record<string, unknown>;
    }>,
    context: { request: Request },
  ): Promise<PaymentRequirements[]>;

  createPaymentRequiredResponse(
    requirements: PaymentRequirements[],
    resource: { url: string; method: string; description?: string },
    error?: string,
    extensions?: Record<string, unknown>,
  ): Promise<PaymentRequired>;

  findMatchingRequirements(
    requirements: PaymentRequirements[],
    payload: unknown,
  ): PaymentRequirements;

  verifyPayment(
    payload: unknown,
    requirements: PaymentRequirements,
  ): Promise<{ isValid: boolean; payer?: string }>;

  settlePayment(
    payload: unknown,
    requirements: PaymentRequirements,
    declaredExtensions?: Record<string, unknown>,
    transportContext?: unknown,
    settlementOverrides?: { amount?: string },
  ): Promise<SettleResponse>;
}

// ---------------------------------------------------------------------------
// Protocol / Auth
// ---------------------------------------------------------------------------

export type ProtocolType = 'x402' | 'mpp';
export type AuthMode = 'paid' | 'siwx' | 'apiKey' | 'unprotected';
export type RouteMethod = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';

export interface RouteDefinition<K extends string = string> {
  /**
   * Public API path segment (without `/api/` prefix).
   * Example: `flightaware/airports/id/flights/arrivals`
   */
  path: K;
  /**
   * Internal route ID for pricing maps / analytics. Defaults to `path`.
   *
   * In `strictRoutes` mode, custom keys are disallowed to prevent discovery
   * drift between internal IDs and advertised paths.
   */
  key?: string;
  /**
   * Optional explicit method. If omitted, defaults to builder behavior
   * (`POST`, or `GET` when `.query()` is used).
   */
  method?: RouteMethod;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export interface TierConfig {
  price: string;
  label?: string;
}

export type PricingConfig<TBody = unknown> =
  | string
  | ((body: TBody) => string | Promise<string>)
  | { field: string; tiers: Record<string, TierConfig>; default?: string };

export type PayToConfig = string | ((request: Request, body?: unknown) => string | Promise<string>);

interface X402AcceptBase {
  network: string;
  asset?: string;
  decimals?: number;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

export interface X402AcceptConfig extends X402AcceptBase {
  scheme?: string;
  payTo?: PayToConfig;
}

export interface X402ResolvedAccept extends X402AcceptBase {
  scheme: string;
  payTo: string;
}

export interface X402RouterFacilitatorConfig extends FacilitatorConfig {
  createAcceptsHeaders?: () => Promise<Record<string, string>>;
}

export type X402FacilitatorTarget = string | X402RouterFacilitatorConfig;

export interface X402FacilitatorsConfig {
  evm?: X402FacilitatorTarget;
  solana?: X402FacilitatorTarget;
}

export interface MppProtocolInfo {
  method?: string;
  intent?: string;
  currency?: string;
}

export interface PaidOptions {
  protocols?: ProtocolType[];
  maxPrice?: string;
  minPrice?: string;
  /** Override the payment recipient. String for static, function for dynamic (receives the Request). */
  payTo?: PayToConfig;
  /** Override MPP protocol metadata in x-payment-info discovery. */
  mpp?: MppProtocolInfo;
  /**
   * Handler-driven dynamic pricing. The handler receives a `charge()` callback
   * and bills the request one tick at a time, capped at `maxPrice`. Total
   * billed is `tickCost * call_count`; zero calls means the request runs free.
   *
   * Requires `maxPrice`. Incompatible with tiered pricing. On x402 routes, the
   * configured accepts must include an `upto` accept on at least one network
   * (Permit2Proxy enforces the cap on chain). On MPP routes,
   * `RouterConfig.mpp.session` must be configured.
   */
  dynamic?: boolean;
  /**
   * Per-tick cost in decimal-dollar form (positive decimal string). Required
   * on `.paid({ dynamic: true })` routes. For MPP session routes this is
   * also the granularity at which voucher headroom is checked.
   */
  tickCost?: string;
  /**
   * Cosmetic unit label for 402 challenges and client UIs (e.g. `'token'`,
   * `'byte'`). Does not affect billing.
   */
  unitType?: string;
}

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

export type PaymentStatus = 'verified' | 'settled';

export interface HandlerPaymentContext {
  protocol: ProtocolType;
  status: PaymentStatus;
  payer: string;
  amount: string;
  network: string;
  recipient?: string;
  transaction?: string;
  receipt?: string;
}

export interface SettlementLifecycleContext<TBody = unknown> {
  route: string;
  request: NextRequest;
  body: TBody;
  wallet: string;
  account: unknown;
  payment: HandlerPaymentContext;
  response: NextResponse;
  result: unknown;
}

export interface SettlementSettledContext<TBody = unknown> extends Omit<
  SettlementLifecycleContext<TBody>,
  'payment'
> {
  payment: HandlerPaymentContext & { status: 'settled' };
}

export interface SettlementErrorContext<TBody = unknown> extends SettlementLifecycleContext<TBody> {
  error: unknown;
  phase: 'settle' | 'afterSettle';
}

export interface SettledHandlerErrorContext<
  TBody = unknown,
> extends SettlementSettledContext<TBody> {
  error: unknown;
}

export interface SettlementLifecycle<TBody = unknown> {
  /**
   * Runs after the handler returns a successful response, before router-controlled
   * settlement/broadcast. Throw with `.status` to return a specific error and
   * skip settlement when the protocol flow has not already settled.
   */
  beforeSettle?: (ctx: SettlementLifecycleContext<TBody>) => void | Promise<void>;
  /**
   * Runs after successful settlement. Use for durable ledgers and audit rows.
   * Errors are alerted and do not change the already-settled response.
   */
  afterSettle?: (ctx: SettlementSettledContext<TBody>) => void | Promise<void>;
  /**
   * Runs when the router has already observed a settled payment, then the
   * handler returns an error response. Use for app-owned refund or
   * compensation queues.
   */
  onSettledHandlerError?: (ctx: SettledHandlerErrorContext<TBody>) => void | Promise<void>;
  /** Runs when router-controlled settlement fails after the handler succeeded. */
  onSettlementError?: (ctx: SettlementErrorContext<TBody>) => void | Promise<void>;
}

/**
 * Bills one tick (`tickCost` USDC) per call. Total is capped at `maxPrice`
 * — exceeding the cap throws synchronously at the offending call site.
 *
 * Only available on **streaming** dynamic handlers (`async function*`). MPP
 * session streams thread this through to per-tick voucher debits; `await
 * charge()` may block on `payment-need-voucher` when the channel runs short.
 * x402 `upto` routes use the cumulative atomic amount as the on-chain settle.
 *
 * Request-mode dynamic handlers do NOT receive `charge()` — the wire bills
 * exactly `tickCost` per request via mppx's non-SSE auto-charge (or the
 * upfront x402 `upto` cap settled for `tickCost`). To meter per-token/byte
 * billing in a non-streaming handler, return the value upfront and use an
 * async generator handler instead.
 */
export type ChargeFn = () => Promise<void>;

export interface HandlerContext<TBody = undefined, TQuery = undefined> {
  body: TBody;
  query: TQuery;
  request: NextRequest;
  requestId: string;
  route: string;
  wallet: string | null;
  payment: HandlerPaymentContext | null;
  account: unknown;
  alert: AlertFn;
  setVerifiedWallet: (addr: string) => void;
}

/**
 * Handler context for streaming `.paid({ dynamic: true })` handlers (async
 * generators). Adds the `charge()` callback the handler invokes once per
 * unit (token/byte/frame) billed.
 *
 * Non-streaming dynamic handlers receive the base `HandlerContext` — they
 * always bill exactly `tickCost` per request and have no `charge` callback.
 */
export interface StreamingHandlerContext<
  TBody = undefined,
  TQuery = undefined,
> extends HandlerContext<TBody, TQuery> {
  charge: ChargeFn;
}

// ---------------------------------------------------------------------------
// Provider monitoring
// ---------------------------------------------------------------------------

export type OveragePolicy = 'same-rate' | 'increased-rate' | 'hard-stop';
export type QuotaLevel = 'healthy' | 'warn' | 'critical';

export interface QuotaInfo {
  remaining: number | null;
  limit: number | null;
  spend?: number;
}

export interface ProviderConfig {
  extractQuota?: (result: unknown, headers: Headers) => QuotaInfo | null;
  monitor?: () => Promise<QuotaInfo | null>;
  overage?: OveragePolicy;
  warn?: number;
  critical?: number;
}

export interface ProviderQuotaEvent {
  provider: string;
  route: string;
  remaining: number | null;
  limit: number | null;
  spend?: number;
  level: QuotaLevel;
  overage: OveragePolicy;
  message: string;
}

// ---------------------------------------------------------------------------
// Route registry entry
// ---------------------------------------------------------------------------

export interface RouteEntry {
  key: string;
  authMode: AuthMode;
  /**
   * Enables SIWX acceleration on paid routes.
   * When true, valid SIWX proofs can bypass repeat payment if entitlement exists.
   */
  siwxEnabled?: boolean;
  pricing?: PricingConfig;
  /** When true the route is dynamic-priced; bills `tickCost` per request (request-mode) or per `charge()` call (streaming). */
  dynamicPrice?: boolean;
  /**
   * True iff the handler is an async generator (`async function*`). Streaming
   * handlers settle through the per-tick SSE flow; non-streaming dynamic
   * handlers bill exactly `tickCost` per request and settle through plain
   * HTTP (MPP) / static x402 paths. Set by the builder at `.handler(fn)`
   * registration time.
   */
  streaming?: boolean;
  protocols: ProtocolType[];
  bodySchema?: ZodType;
  querySchema?: ZodType;
  outputSchema?: ZodType;
  /**
   * Optional conforming example for the request input (body for body routes, query params for query routes).
   * When present, it must satisfy the corresponding schema and is validated at route registration.
   *
   * Emitted in the bazaar discovery extension so indexers can advertise a working sample call.
   */
  inputExample?: JsonObject;
  /**
   * Optional conforming example for the response output. When present, it must
   * satisfy `outputSchema` and is validated at route registration.
   *
   * Accepts any JSON value (object, array, or primitive) to support top-level array or
   * primitive response schemas.
   *
   * Emitted in the bazaar discovery extension. Without it the `output` block is
   * dropped from the declaration entirely (the output schema alone cannot be
   * exposed in bazaar without an example).
   */
  outputExample?: JsonValue;
  description?: string;
  path?: string;
  method: RouteMethod;
  maxPrice?: string;
  minPrice?: string;
  payTo?: PayToConfig;
  apiKeyResolver?: (key: string) => unknown | Promise<unknown>;
  providerName?: string;
  providerConfig?: ProviderConfig;
  validateFn?: (body: unknown) => void | Promise<void>;
  settlement?: SettlementLifecycle;
  mppInfo?: MppProtocolInfo;
  /** Per-tick cost (decimal-dollar). Required when `dynamicPrice` is true. */
  tickCost?: string;
  /** Cosmetic unit label for 402 challenges and client UIs. */
  unitType?: string;
}

// ---------------------------------------------------------------------------
// Discovery config
// ---------------------------------------------------------------------------

export interface DiscoveryConfig {
  title: string;
  version: string;
  description?: string;
  contact?: { name?: string; url?: string };
  ownershipProofs?: string[];
  methodHints?: 'off' | 'non-default' | 'always';
  /** Natural language guidance for agents. Served as wellknown `instructions` and `/llms.txt`. */
  guidance?: string | (() => string | Promise<string>);
  /** Override the OpenAPI `servers` URL. Defaults to `RouterConfig.baseUrl`. Use when the public API hostname differs from the payment realm URL. */
  serverUrl?: string;
}

// ---------------------------------------------------------------------------
// Router config
// ---------------------------------------------------------------------------

export interface RouterConfig {
  payeeAddress?: string;
  /**
   * Origin URL (e.g. `https://myapp.com`).
   * Used for 402 challenge realm, discovery URLs, OpenAPI servers, and MPP memo indexing.
   *
   * **Required.** No auto-detection — the realm is load-bearing for payment matching,
   * so it must be explicitly set by the consuming app.
   */
  baseUrl: string;
  network?: string;
  x402?: {
    accepts?: X402AcceptConfig[];
    facilitators?: X402FacilitatorsConfig;
    /**
     * Cache layer for facilitator `/supported` responses (used by `upto` to
     * read `facilitatorAddress` and asset metadata). Without a `store`, only
     * per-process memoization applies — `M` cold-starting lambdas → `M` raw
     * HTTP calls. Pass a shared KV here to coordinate across the fleet.
     *
     * mppx-shape stores can be wrapped via `mppxStoreAdapter` to satisfy
     * `SupportedKVStore`.
     */
    supportedCache?: {
      store?: import('./protocols/x402/supported.js').SupportedKVStore;
      ttlMs?: number;
    };
  };
  plugin?: import('./plugin.js').RouterPlugin;
  siwx?: {
    nonceStore?: import('./auth/nonce.js').NonceStore;
    entitlementStore?: import('./auth/entitlement.js').EntitlementStore;
  };
  prices?: Record<string, string>;
  mpp?: {
    secretKey: string;
    currency: string;
    recipient?: string;
    /** Tempo RPC URL for on-chain verification. Falls back to TEMPO_RPC_URL env var. */
    rpcUrl?: string;
    /**
     * Private key of the server's operator account. Signs on-chain channel
     * close/settle. Required when `session` is configured.
     *
     * **Address must equal `recipient`/payee.** mppx's close handler asserts
     * `sender === payee` on settle — a mismatch causes every close attempt
     * to be rejected and reissued as a fresh 402. The router validates this
     * at init and throws clearly if they differ.
     *
     * Must be a hex-encoded private key (e.g. `0xabc123...`).
     */
    operatorKey?: string;
    /**
     * Private key of the fee-sponsor account. When set, pays transaction gas
     * on behalf of clients for channel open/topUp (so clients don't need to
     * hold native fee currency on Tempo).
     *
     * **Must resolve to a different address than `operatorKey`.** Tempo's
     * RPC rejects fee-delegated transactions where `sender === feePayer`
     * with `-32000 "fee payer cannot resolve to sender"`. The router
     * enforces this at init.
     *
     * Omit to disable sponsorship — clients then pay their own gas (in USDC
     * on Tempo). The operator key still pays its own gas for close/settle.
     *
     * Must be a hex-encoded private key (e.g. `0xabc123...`).
     */
    feePayerKey?: string;
    /**
     * Persistent store for transaction hash replay protection.
     *
     * Without this, mppx defaults to `Store.memory()` which is wiped on every cold start —
     * unsafe on Vercel or any multi-instance deployment. Pass `Store.upstash(redis)` or
     * `Store.cloudflare(kv)` for a shared persistent store.
     *
     * @example
     * import { Store } from 'mppx'
     * store: Store.upstash({ get, set, del })
     * store: Store.cloudflare(env.MY_KV_NAMESPACE)
     */
    store?: Store.Store;
    /**
     * When `true`, auto-configures an Upstash-backed persistent store from Vercel KV
     * environment variables (`KV_REST_API_URL` + `KV_REST_API_TOKEN`).
     *
     * Uses raw `fetch` against the Upstash REST API — no extra npm dependencies.
     * Ignored when `store` is explicitly provided.
     *
     * @example
     * createRouter({
     *   mpp: {
     *     secretKey: process.env.MPP_SECRET_KEY!,
     *     currency: TEMPO_USDC_CURRENCY,
     *     useDefaultStore: true,
     *   }
     * })
     */
    useDefaultStore?: boolean;
    /**
     * Enables MPP payment-channel sessions. When set, the router registers
     * `tempo.session` (non-SSE, for request-mode dynamic handlers) AND
     * `tempo.session({ sse: true })` (for streaming dynamic handlers) so
     * dynamic-priced routes can verify and settle session credentials. Per-tick
     * cost and unit label are declared per-route via
     * `.paid({ dynamic: true, tickCost, unitType })`.
     *
     * Also requires `mpp.operatorKey` (signs channel close/settle).
     */
    session?: {
      /**
       * Suggested-deposit multiplier for the 402 challenge on dynamic routes.
       * The client is asked to deposit `tickCost × depositMultiplier` USDC
       * into the channel — covers N requests of `tickCost` before requiring a
       * topUp. Higher values reduce on-chain topUp frequency at the cost of
       * larger client deposits per channel.
       *
       * Routes can override via `.paid({ dynamic: true, maxPrice })` — when
       * `maxPrice` is set it takes precedence over `tickCost × depositMultiplier`.
       *
       * @default 10
       */
      depositMultiplier?: number;
    };
  };
  /**
   * Payment protocols to accept on paid routes unless a route overrides them.
   *
   * @default ['x402']
   *
   * @example
   * // Accept both x402 and MPP payments
   * createRouter({
   *   protocols: ['x402', 'mpp'],
   *   mpp: { secretKey, currency: TEMPO_USDC_CURRENCY, recipient },
   *   prices: { 'exa/search': '0.01' }
   * })
   */
  protocols?: ProtocolType[];
  /**
   * Enforce explicit, path-first route definitions.
   *
   * When enabled:
   * - `.route('key')` is rejected; use `.route({ path })`.
   * - custom `key` differing from `path` is rejected.
   *
   * This prevents discovery/openapi drift caused by shorthand internal keys.
   */
  strictRoutes?: boolean;
  discovery: DiscoveryConfig;
}
