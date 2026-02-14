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
  apiKeyResolver?: (key: string) => unknown | Promise<unknown>;
  providerName?: string;
  providerConfig?: ProviderConfig;
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
  };
}
