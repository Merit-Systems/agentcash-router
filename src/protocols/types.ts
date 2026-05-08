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
  /**
   * Decimal-dollar amount to settle. For dynamic-priced routes this is the
   * handler's `charge()` running total; for static routes it equals the
   * verified quoted price. Strategies that need a tick count (MPP session)
   * derive it from `billedAmount / tickCost`.
   */
  billedAmount: string;
}

/**
 * Streaming settle path — called when the handler returned an `AsyncIterable`
 * instead of a value. Strategies opt in by implementing this; the flow rejects
 * streaming routes at registration when the strategy hasn't provided it.
 */
export interface StreamSettleArgs {
  request: NextRequest;
  /** The handler's async iterable; yields are data, not billing signals. */
  source: AsyncIterable<unknown>;
  payment: HandlerPaymentContext;
  token: unknown;
  routeEntry: RouteEntry;
  deps: RouterDeps;
  /**
   * Connects the handler's `charge()` callback to the protocol's per-tick
   * channel debit. Strategies (MPP session) call this with their per-tick
   * callback once iteration starts and clear it back to `null` when iteration
   * ends. Always present — streaming handlers are gated to dynamic-priced
   * routes upstream.
   */
  bindChannelCharge: (fn: (() => Promise<void>) | null) => void;
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

/**
 * Pre-verify classification — strategies inspect the credential header before
 * body parse / handler invocation and signal whether the orchestrator should
 * bypass them. Used by MPP session channel-management credentials
 * (close/topUp/bodyless open|voucher) which carry no body and don't need
 * handler invocation: settle alone emits the channel-state receipt.
 */
export interface PreflightOutcome {
  /** Skip body parse + validate + price quote for this request. */
  skipBody: boolean;
  /** Skip handler invocation; settle receives an empty 200 placeholder. */
  skipHandler: boolean;
}

export interface PaymentStrategy {
  readonly protocol: ProtocolName;

  /** Header sniff: does this request carry a payment for me? */
  detects(request: Request): boolean;

  /**
   * Classify the credential before body parse. Strategies that don't need
   * special orchestration return null. Returning a value short-circuits the
   * standard pipeline per the flag values.
   */
  preflight?(request: Request, routeEntry: RouteEntry): PreflightOutcome | null;

  verify(args: VerifyArgs): Promise<VerifyOutcome>;

  /** Called only after handler returned a 2xx response. */
  settle(args: SettleArgs): Promise<SettleOutcome>;

  /**
   * Settle a streaming handler whose response is an async iterable. Optional —
   * strategies without streaming support leave this unset and the flow rejects
   * streaming routes at registration time.
   */
  settleStream?(args: StreamSettleArgs): Promise<SettleOutcome>;

  /** Contribute this protocol's piece to a 402 challenge. */
  buildChallenge(args: ChallengeArgs): Promise<ChallengeContribution>;
}
