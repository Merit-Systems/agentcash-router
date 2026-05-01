import type { NextRequest, NextResponse } from 'next/server';
import type { HandlerPaymentContext, RouteEntry } from '../types.js';
import type { RouterDeps } from '../pipeline/context/index.js';

export type ProtocolName = 'x402' | 'mpp';

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export interface VerifyArgs {
  request: NextRequest;
  body: unknown;
  price: string;
  routeEntry: RouteEntry;
  deps: RouterDeps;
}

export interface VerifySuccess {
  ok: true;
  wallet: string;
  payment: HandlerPaymentContext;
  /** Strategy-specific state threaded through to settle(). Opaque to the orchestrator. */
  token: unknown;
  /**
   * True when the payment is already final on-chain at verify time (e.g., MPP
   * hash-payload). When true, the orchestrator runs `onSettledHandlerError`
   * instead of skipping settlement on handler failure.
   */
  alreadySettled?: boolean;
}

export type VerifyOutcome =
  | VerifySuccess
  | { ok: false; kind: 'invalid' } // client problem → 402 challenge
  | { ok: false; kind: 'config'; message: string }; // server config → 500

// ---------------------------------------------------------------------------
// Settle
// ---------------------------------------------------------------------------

export interface SettleArgs {
  request: NextRequest;
  response: NextResponse;
  payment: HandlerPaymentContext;
  token: unknown;
  routeEntry: RouteEntry;
  deps: RouterDeps;
}

export type SettleOutcome =
  | {
      ok: true;
      response: NextResponse;
      settledPayment: HandlerPaymentContext & { status: 'settled' };
    }
  | { ok: false; error: unknown; failMessage: string; failStatus?: number };

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

export interface ChallengeArgs {
  request: NextRequest;
  routeEntry: RouteEntry;
  body: unknown | undefined;
  price: string;
  extensions?: Record<string, unknown>;
  deps: RouterDeps;
}

export interface ChallengeContribution {
  /** Header value(s) to set on the 402 response (e.g., PAYMENT-REQUIRED, WWW-Authenticate). */
  headers?: Record<string, string>;
  /** Optional body fragment to merge into the 402 JSON. */
  body?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

export interface PaymentStrategy {
  readonly protocol: ProtocolName;

  /** Header sniff: does this request carry a payment for me? */
  detects(request: Request): boolean;

  verify(args: VerifyArgs): Promise<VerifyOutcome>;

  /** Called only after handler returned a 2xx response. */
  settle(args: SettleArgs): Promise<SettleOutcome>;

  /** Contribute this protocol's piece to a 402 challenge. */
  buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution>;
}
