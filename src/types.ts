import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';

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
// x402 server interface
// ---------------------------------------------------------------------------

// Typed interface for x402ResourceServer using @x402/core's own types.
// Enforces correct method names, async signatures, and array vs single arg.
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';

export interface X402Server {
  initialize(): Promise<void>;

  buildPaymentRequirementsFromOptions(
    options: Array<{ scheme: string; network: string; price: string; payTo: string }>,
    context: { request: Request },
  ): Promise<PaymentRequirements[]>;

  createPaymentRequiredResponse(
    requirements: PaymentRequirements[],
    resource: { url: string; method: string; description?: string },
    error: string | null,
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

  settlePayment(payload: unknown, requirements: PaymentRequirements): Promise<SettleResponse>;
}

// ---------------------------------------------------------------------------
// Protocol / Auth
// ---------------------------------------------------------------------------

export type ProtocolType = 'x402' | 'mpp';
export type AuthMode = 'paid' | 'siwx' | 'apiKey' | 'unprotected';

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

export interface PaidOptions {
  protocols?: ProtocolType[];
  maxPrice?: string;
  minPrice?: string;
}

// ---------------------------------------------------------------------------
// Handler context
// ---------------------------------------------------------------------------

export interface HandlerContext<TBody = undefined, TQuery = undefined> {
  body: TBody;
  query: TQuery;
  request: NextRequest;
  requestId: string;
  route: string;
  wallet: string | null;
  account: unknown;
  alert: AlertFn;
  setVerifiedWallet: (addr: string) => void;
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
  pricing?: PricingConfig;
  protocols: ProtocolType[];
  bodySchema?: ZodType;
  querySchema?: ZodType;
  outputSchema?: ZodType;
  description?: string;
  path?: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  maxPrice?: string;
  minPrice?: string;
  apiKeyResolver?: (key: string) => unknown | Promise<unknown>;
  providerName?: string;
  providerConfig?: ProviderConfig;
  validateFn?: (body: unknown) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Router config
// ---------------------------------------------------------------------------

export interface RouterConfig {
  payeeAddress: string;
  network?: string;
  facilitatorUrl?: string;
  plugin?: import('./plugin.js').RouterPlugin;
  siwx?: { nonceStore?: import('./auth/nonce.js').NonceStore };
  prices?: Record<string, string>;
  mpp?: {
    secretKey: string;
    currency: string;
    recipient?: string;
    /** Tempo RPC URL for on-chain verification. Falls back to TEMPO_RPC_URL env var. */
    rpcUrl?: string;
  };
  /**
   * Payment protocols to accept on auto-priced routes (those using the `prices` config).
   *
   * @default ['x402']
   *
   * @example
   * // Accept both x402 and MPP payments
   * createRouter({
   *   protocols: ['x402', 'mpp'],
   *   mpp: { secretKey, currency, recipient },
   *   prices: { 'exa/search': '0.01' }
   * })
   */
  protocols?: ProtocolType[];
}
