import type { FacilitatorConfig } from '@x402/core/http';
import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import type {
  PaymentRequired,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from '@x402/core/types';

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type AlertLevel = 'info' | 'warn' | 'error' | 'critical';

export interface AlertEvent {
  level: AlertLevel;
  message: string;
  route: string;
  meta?: Record<string, unknown>;
}

export type AlertFn = (level: AlertLevel, message: string, meta?: Record<string, unknown>) => void;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

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

  verifyPayment(payload: unknown, requirements: PaymentRequirements): Promise<VerifyResponse>;

  settlePayment(
    payload: unknown,
    requirements: PaymentRequirements,
    declaredExtensions?: Record<string, unknown>,
    transportContext?: unknown,
    settlementOverrides?: { amount?: string },
  ): Promise<SettleResponse>;
}

export type ProtocolType = 'x402' | 'mpp';
export type AuthMode = 'paid' | 'siwx' | 'apiKey' | 'unprotected';
export type RouteMethod = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';

export interface RouteDefinition<K extends string = string> {
  /** Public API path segment without the `/api/` prefix (e.g. `flightaware/airports/id/flights/arrivals`). */
  path: K;
  /** Internal route ID for pricing maps / analytics. Defaults to `path`. Disallowed under `strictRoutes` to prevent discovery drift. */
  key?: string;
  /** Explicit HTTP method. Defaults to `POST`, or `GET` when `.query()` is used. */
  method?: RouteMethod;
}

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
  /** Chain identifier (e.g. `base`, `base-sepolia`, `solana-mainnet`). */
  network: string;
  /** Token contract address (EVM) or mint (Solana). Defaults to USDC for the network. */
  asset?: string;
  /** Token decimals. Defaults to USDC's 6. */
  decimals?: number;
  /** Max payment-proof age the facilitator will accept, in seconds. */
  maxTimeoutSeconds?: number;
  /** Extra fields passed through to the x402 PaymentRequirements `extra` block. */
  extra?: Record<string, unknown>;
}

export interface X402AcceptConfig extends X402AcceptBase {
  /** `'exact'` for fixed-price one-shot payments; `'upto'` for settle-≤-cap (required for `.upTo()` routes). @default 'exact' */
  scheme?: string;
  /** Per-accept payee override. Function form receives the request and parsed body for dynamic recipient routing. Falls back to `RouterConfig.payeeAddress`. */
  payTo?: PayToConfig;
}

export interface X402ResolvedAccept extends X402AcceptBase {
  scheme: string;
  payTo: string;
}

export interface X402RouterFacilitatorConfig extends FacilitatorConfig {
  /** Async header builder invoked per facilitator call. Use for short-lived auth tokens (e.g. CDP signed headers). */
  createAcceptsHeaders?: () => Promise<Record<string, string>>;
}

/** A facilitator URL or a full `FacilitatorConfig` (URL + auth header builders). */
export type X402FacilitatorTarget = string | X402RouterFacilitatorConfig;

export interface X402FacilitatorsConfig {
  /** Facilitator for Solana. Defaults to {@link DEFAULT_SOLANA_FACILITATOR_URL}. The EVM facilitator is hardcoded to Coinbase (CDP) — set `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`. */
  solana?: X402FacilitatorTarget;
}

export interface MppProtocolInfo {
  method?: string;
  intent?: string;
  currency?: string;
  settleBeforeHandler?: boolean;
}

export type CheckoutSessionResponse = Record<string, unknown>;

export interface CheckoutSessionContext<TBody = unknown> {
  request: NextRequest;
  route: string;
  body: TBody | undefined;
  /** Decimal-dollar price quoted for this 402 challenge. */
  price: string;
}

export type CheckoutSessionFn<TBody = unknown> = (
  ctx: CheckoutSessionContext<TBody>,
) =>
  | CheckoutSessionResponse
  | null
  | undefined
  | Promise<CheckoutSessionResponse | null | undefined>;

export interface PaidOptions {
  protocols?: ProtocolType[];
  maxPrice?: string;
  minPrice?: string;
  /** Override the payment recipient. String for static, function for body-derived (receives the Request). */
  payTo?: PayToConfig;
  /** Override MPP protocol metadata in x-payment-info discovery. */
  mpp?: MppProtocolInfo;
  /** Signal in discovery that clients should use an explicit checkout flow before payment. */
  checkout?: boolean;
  /**
   * Build dynamic checkout review metadata for the router-owned 402 response body.
   *
   * The returned object is emitted as `{ "checkout_session": ... }` on the unpaid
   * payment challenge response. Payment terms remain authoritative in the x402/MPP
   * challenge headers.
   */
  checkoutSession?: CheckoutSessionFn;
}
export type PaidArg =
  | (PaidOptions & { price: string }) // fixed price (any protocol)
  | (PaidOptions & { field: string; tiers: Record<string, TierConfig>; default?: string }); // body-derived pricing (any protocol)

export interface UpToOptions extends Omit<PaidOptions, 'maxPrice'> {
  /** Cap on total billed amount; handler-accumulated `charge(amount)` calls cannot exceed this. */
  maxPrice: string;
  /** Cosmetic unit label for 402 challenges / UIs. Does not affect billing. */
  unitType?: string;
}

export interface MeteredOptions extends Omit<PaidOptions, 'maxPrice'> {
  /** Per-tick cost (positive decimal-dollar string). On `.handler()` bills exactly this per request; on `.stream()` is the voucher-headroom granularity. */
  tickCost: string;
  /** Cap on total billed amount (streaming only — request-mode bills exactly `tickCost`). */
  maxPrice: string;
  /** Cosmetic unit label for 402 challenges / UIs (e.g. `'token'`, `'byte'`). Does not affect billing. */
  unitType?: string;
}

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
  /** Runs after a successful handler response, before router-controlled settlement/broadcast. Throw with `.status` to fail the request and skip settlement (when not already settled). */
  beforeSettle?: (ctx: SettlementLifecycleContext<TBody>) => void | Promise<void>;
  /** Runs after successful settlement; for durable ledgers and audit rows. Errors are alerted but don't change the already-settled response. */
  afterSettle?: (ctx: SettlementSettledContext<TBody>) => void | Promise<void>;
  /** Runs when payment was settled but the handler then returned an error response. Use for app-owned refund / compensation queues. */
  onSettledHandlerError?: (ctx: SettledHandlerErrorContext<TBody>) => void | Promise<void>;
  /** Runs when router-controlled settlement fails after the handler succeeded. */
  onSettlementError?: (ctx: SettlementErrorContext<TBody>) => void | Promise<void>;
}

export type ChargeFn = () => Promise<void>;
export type UptoChargeFn = (amount: string) => Promise<void>;

export interface HandlerContext<TBody = undefined, TQuery = undefined> {
  body: TBody;
  query: TQuery;
  request: NextRequest;
  requestId: string;
  route: string;
  wallet: string | null;
  /** Optional DID from `X-Agent-Identity` proof. Null when the client omits identity. */
  actor: string | null;
  payment: HandlerPaymentContext | null;
  account: unknown;
  alert: AlertFn;
  setVerifiedWallet: (addr: string) => void;
}

/** Handler context for streaming `.metered()` handlers (async generators). Call `charge()` once per billable unit. */
export interface StreamingHandlerContext<
  TBody = undefined,
  TQuery = undefined,
> extends HandlerContext<TBody, TQuery> {
  charge: ChargeFn;
}

/** Handler context for `.upTo()` routes (x402-only). Call `charge(amount)` one or more times; the request settles for the accumulated total capped at `maxPrice`. */
export interface UptoHandlerContext<TBody = undefined, TQuery = undefined> extends HandlerContext<
  TBody,
  TQuery
> {
  charge: UptoChargeFn;
}

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

export interface RouteEntry {
  key: string;
  authMode: AuthMode;
  /**
   * Enables SIWX acceleration on paid routes.
   * When true, valid SIWX proofs can bypass repeat payment if entitlement exists.
   */
  siwxEnabled?: boolean;
  pricing?: PricingConfig;
  /** `'exact'` settles a fixed price once; `'upto'` (x402-only) settles the handler-accumulated `charge(amount)` total capped at `maxPrice`; `'metered'` (MPP-only) bills per `tickCost`. */
  billing: 'exact' | 'upto' | 'metered';
  /** True iff handler is an async generator. Streaming handlers settle per-tick over SSE; non-streaming metered handlers bill exactly `tickCost` per request. Set by the builder at `.handler(fn)` time. */
  streaming?: boolean;
  protocols: ProtocolType[];
  bodySchema?: ZodType;
  querySchema?: ZodType;
  outputSchema?: ZodType;
  /** Optional conforming example for the request input (body or query). Validated against the schema at registration. Emitted in the bazaar discovery extension. */
  inputExample?: JsonObject;
  /** Optional conforming example for the response output (any JSON value). Validated against `outputSchema` at registration. Without it, the bazaar `output` block is omitted (schema alone can't be exposed). */
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
  hasCheckout?: boolean;
  checkoutSession?: CheckoutSessionFn;
  /** Per-tick cost (decimal-dollar). Required when `metered` is true. */
  tickCost?: string;
  /** Cosmetic unit label for 402 challenges and client UIs. */
  unitType?: string;
}

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

export interface RouterConfig {
  /** Default payee for paid routes — populates `payTo` on the auto-generated x402 `exact` accept and acts as the MPP `recipient` fallback. Override per-protocol via `x402.accepts[i].payTo` / `mpp.recipient`, or per-route via the `payTo` option on `.paid()` / `.upTo()` / `.metered()`. */
  payeeAddress?: string;
  /** Origin URL (required). Used as 402 realm, discovery base, OpenAPI server, and MPP memo prefix — must match the public domain or payment matching breaks. */
  baseUrl: string;
  /** Default chain for the auto-generated x402 `exact` accept (e.g. `base`, `base-sepolia`). Ignored when `x402.accepts` is set. @default 'base' */
  network?: string;
  /** x402 protocol settings. Omit to default to a single `exact`/USDC accept on `network` paid to `payeeAddress`, verified via the Coinbase default facilitator (requires `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET`). */
  x402?: {
    /** Explicit accepts list (scheme + network + asset). Overrides the auto-generated default. Add an `upto` accept here to enable `.upTo()` routes. */
    accepts?: X402AcceptConfig[];
    /** Per-chain facilitator overrides (`evm`/`solana`). Defaults to the Coinbase facilitator on EVM; set `solana` to accept Solana payments. */
    facilitators?: X402FacilitatorsConfig;
  };
  /** Observability hook receiving request/auth/payment/settlement events. Implement `RouterPlugin` for structured logs/analytics. */
  plugin?: import('./plugin/index.js').RouterPlugin;
  /** Single KV cache for SIWX nonce, SIWX entitlement, and MPP tx-hash replay (prefixed `siwx:nonce:`, `siwx:ent:`, `mpp:`). Pass `{ url, token }` for an Upstash-compatible REST endpoint (Upstash, Vercel KV), or a custom `KvStore` implementation. Omitted: auto-bootstraps from `KV_REST_API_URL` + `KV_REST_API_TOKEN`; falls back to in-memory when missing (unsafe in serverless). */
  kvStore?: import('./kv-store/index.js').KvStore | { url: string; token: string };
  /** Centralized price map keyed by route ID. `.route(key)` auto-applies `.paid(prices[key])` when `key` is listed; per-route `.paid()` still works for keys not in the map. */
  prices?: Record<string, string>;
  /** MPP (Tempo) payment-channel config. Required when `protocols` includes `'mpp'`. */
  mpp?: {
    /** HMAC key for signing/verifying MPP challenge nonces. Persist across deploys — rotating invalidates outstanding 402 challenges. Falls back to `MPP_SECRET_KEY`. */
    secretKey: string;
    /** Tempo currency contract address (0x-prefixed). Use `TEMPO_USDC_ADDRESS` for USDC on Tempo. */
    currency: string;
    /** MPP payee address (EVM). Overrides `payeeAddress` for MPP only. Required when `payeeAddress` is unset. MUST equal `operatorKey`'s derived address when `session` is enabled. */
    recipient?: string;
    /** Tempo RPC URL for on-chain verification. Falls back to `TEMPO_RPC_URL`, then to the public `DEFAULT_TEMPO_RPC_URL`. */
    rpcUrl?: string;
    /** Hex private key. Signs channel close/settle; required for `session`. Address MUST equal `recipient`/payee — mppx asserts sender===payee on settle. Validated at init. */
    operatorKey?: string;
    /** Hex private key. Sponsors gas for client channel open/topUp. MUST resolve to a different address than `operatorKey` — Tempo rejects sender===feePayer. Validated at init. Omit to make clients pay their own gas. */
    feePayerKey?: string;
    /** Enables MPP payment-channel sessions for `.metered()` routes (registers both request and SSE session middleware). Also requires `mpp.operatorKey`. */
    session?: {
      /** Suggested deposit on the 402 challenge = `tickCost × depositMultiplier` USDC. Route `maxPrice` overrides. @default 10 */
      depositMultiplier?: number;
    };
  };
  /** Payment protocols to accept on paid routes unless overridden per route. @default ['x402'] */
  protocols?: ProtocolType[];
  /** When true, `.route('key')` is rejected (use `.route({ path })`) and custom `key !== path` is rejected. Prevents discovery/openapi drift. */
  strictRoutes?: boolean;
  /** Static metadata for auto-generated discovery surfaces — `/.well-known/x402`, OpenAPI (`/api/openapi`), and `/llms.txt`. */
  discovery: DiscoveryConfig;
}
