import type { NextRequest, NextResponse } from 'next/server';
import type { HandlerPaymentContext, RouteEntry } from '../types.js';
import type { RouterDeps } from '../pipeline/context/index.js';
import type { ReportFn } from '../alert.js';

export type ProtocolName = 'x402' | 'mpp';

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
  readonly protocol: ProtocolName;

  detects(request: Request): boolean;

  preflight?(request: Request, routeEntry: RouteEntry): PreflightOutcome | null;

  verify(args: VerifyArgs): Promise<VerifyOutcome>;

  settle(args: SettleArgs): Promise<SettleOutcome>;

  settleStream?(args: StreamSettleArgs): Promise<SettleOutcome>;

  buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution>;
}
