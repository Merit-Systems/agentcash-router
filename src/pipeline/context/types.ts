import type { NextRequest, NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import type {
  HandlerContext,
  HandlerPaymentContext,
  RouteEntry,
  X402AcceptConfig,
  X402Server,
} from '../../types.js';
import type { ResolvedX402Facilitator } from '../../protocols/x402/facilitators.js';
import type { NonceStore } from '../../auth/nonce.js';
import type { EntitlementStore } from '../../auth/entitlement.js';
import type { PluginContext, RequestMeta, RouterPlugin } from '../../plugin.js';

// ---------------------------------------------------------------------------
// Mppx middleware shape
// ---------------------------------------------------------------------------

/**
 * Shape every mppx middleware returns: a curried verifier whose async result
 * is either a 402 challenge or a 200 with a transport-specific `withReceipt`
 * hook. Parameterized by `mppx/server`'s `Transport` so each method's
 * `withReceipt` argument set tracks the upstream definition exactly:
 *
 *   - `Transport.Http` → `withReceipt(response: Response)` only
 *   - `Transport.Sse`  → also accepts an async generator / generator factory
 *
 * Centralizing here avoids hand-rolling the shape in every consumer (siwx-mode,
 * hash-mode, session-mode, RouterDeps) and stays in lock-step with mppx
 * upstream — when they add a transport (MCP, etc.) we don't have to chase it.
 */
export type MppxMiddlewareResponse<T extends Transport.AnyTransport> =
  | { status: 402; challenge: Transport.ChallengeOutputOf<T> }
  | { status: 200; withReceipt: Transport.WithReceipt<T> };

/** Curried mppx middleware: `(options) → (Request) → Promise<MppxMiddlewareResponse>`. */
export type MppxMiddleware<TOptions, T extends Transport.AnyTransport> = (
  options: TOptions,
) => (input: Request) => Promise<MppxMiddlewareResponse<T>>;

// ---------------------------------------------------------------------------
// RouterDeps — runtime dependencies threaded through every flow
// ---------------------------------------------------------------------------

export interface RouterDeps {
  x402Server: X402Server | null;
  initPromise: Promise<void>;
  x402InitError?: string;
  mppInitError?: string;
  plugin?: RouterPlugin;
  nonceStore: NonceStore;
  entitlementStore: EntitlementStore;
  payeeAddress: string;
  mppRecipient?: string;
  network: string;
  x402FacilitatorsByNetwork?: Record<string, ResolvedX402Facilitator>;
  x402Accepts: X402AcceptConfig[];
  mppx?: {
    charge: MppxMiddleware<{ amount: string }, Transport.Http>;
    /**
     * Session-mode middleware. Present iff `RouterConfig.mpp.session` was
     * configured. Uses mppx's SSE transport — the 200-branch's `withReceipt`
     * accepts a Response, an async generator, or a generator factory; mppx
     * auto-converts iterables to Server-Sent Events with per-tick voucher
     * charging.
     */
    session?: MppxMiddleware<
      { amount: string; unitType?: string; suggestedDeposit?: string },
      Transport.Sse
    >;
  } | null;
  /**
   * Per-deployment session configuration. Set by `createRouter` when
   * `RouterConfig.mpp.session` is configured; null otherwise.
   */
  mppSessionConfig?: {
    tickCost: string;
    unitType: string;
  } | null;
  tempoClient?: import('viem').Client | null;
}

// ---------------------------------------------------------------------------
// FlowCtx — per-request context bundle
// ---------------------------------------------------------------------------

export interface FlowCtx {
  routeEntry: RouteEntry;
  handler: (ctx: HandlerContext) => Promise<unknown>;
  deps: RouterDeps;
  request: NextRequest;
  meta: RequestMeta;
  pluginCtx: PluginContext;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ParseBodyResult = { ok: true; data: unknown } | { ok: false; response: NextResponse };

export interface InvokeResult {
  response: NextResponse;
  rawResult: unknown;
  handlerError?: unknown;
}

export interface SettleScope<TPayment extends HandlerPaymentContext = HandlerPaymentContext> {
  wallet: string;
  account: unknown;
  body: unknown;
  payment: TPayment;
  response: NextResponse;
  rawResult: unknown;
  handlerError?: unknown;
}
