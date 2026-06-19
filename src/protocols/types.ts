import type { NextRequest, NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import type {
  HandlerPaymentContext,
  ProtocolType,
  RouteEntry,
  X402AcceptConfig,
  X402Server,
} from '../types.js';
import type { ResolvedX402Facilitator } from './x402/facilitators.js';
import type { MppxMiddleware } from './mpp/middleware-types.js';
import type { NonceStoreInterface } from 'did-auth-challenge';
import type { NonceStore, EntitlementStore } from '../kv-store/index.js';
import type { RouterPlugin } from '../plugin/index.js';
import type { ReportFn } from '../plugin/reporter.js';

export interface RouterDeps {
  x402Server: X402Server | null;
  initPromise: Promise<void>;
  x402InitError?: string;
  mppInitError?: string;
  plugin?: RouterPlugin;
  nonceStore: NonceStore;
  agentIdentityNonceStore: NonceStoreInterface;
  entitlementStore: EntitlementStore;
  payeeAddress: string;
  mppRecipient?: string;
  network: string;
  x402FacilitatorsByNetwork?: Record<string, ResolvedX402Facilitator>;
  x402Accepts: X402AcceptConfig[];
  mppx?: {
    charge: MppxMiddleware<{ amount: string }, Transport.Http>;
    sessionRequest?: MppxMiddleware<
      { amount: string; unitType?: string; suggestedDeposit?: string },
      Transport.Http
    >;
    sessionStream?: MppxMiddleware<
      { amount: string; unitType?: string; suggestedDeposit?: string },
      Transport.Sse
    >;
  } | null;
  mppSessionConfig?: { depositMultiplier: number } | null;
  tempoClient?: import('viem').Client | null;
}

export interface VerifyArgs {
  request: NextRequest;
  body: unknown;
  price: string;
  routeEntry: RouteEntry;
  deps: RouterDeps;
  report: ReportFn;
}

export interface VerifySuccess {
  ok: true;
  wallet: string;
  payment: HandlerPaymentContext;
  token: unknown;
  alreadySettled?: boolean;
}

export interface VerifyFailure {
  reason: string;
  message?: string;
}

export type VerifyOutcome =
  | VerifySuccess
  | { ok: false; kind: 'invalid'; failure?: VerifyFailure }
  | { ok: false; kind: 'config'; message: string };

export interface SettleArgs {
  request: NextRequest;
  response: NextResponse;
  payment: HandlerPaymentContext;
  token: unknown;
  routeEntry: RouteEntry;
  deps: RouterDeps;
  billedAmount: string;
  report: ReportFn;
}

export interface StreamSettleArgs {
  request: NextRequest;
  source: AsyncIterable<unknown>;
  payment: HandlerPaymentContext;
  token: unknown;
  routeEntry: RouteEntry;
  deps: RouterDeps;
  bindChannelCharge: (fn: (() => Promise<void>) | null) => void;
  report: ReportFn;
}

export type SettleOutcome =
  | {
      ok: true;
      response: NextResponse;
      settledPayment: HandlerPaymentContext & { status: 'settled' };
    }
  | { ok: false; error: unknown; failMessage: string; failStatus?: number };

export interface ChallengeArgs {
  request: NextRequest;
  routeEntry: RouteEntry;
  body: unknown | undefined;
  price: string;
  extensions?: Record<string, unknown>;
  deps: RouterDeps;
  report: ReportFn;
}

export interface ChallengeContribution {
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface PreflightOutcome {
  skipBody: boolean;
  skipHandler: boolean;
}

export interface PaymentStrategy {
  readonly protocol: ProtocolType;

  detects(request: Request): boolean;

  preflight?(request: Request, routeEntry: RouteEntry): PreflightOutcome | null;

  verify(args: VerifyArgs): Promise<VerifyOutcome>;

  settle(args: SettleArgs): Promise<SettleOutcome>;

  settleStream?(args: StreamSettleArgs): Promise<SettleOutcome>;

  buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution>;
}
