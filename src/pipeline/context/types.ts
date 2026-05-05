import type { NextRequest, NextResponse } from 'next/server';
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
    charge: (options: {
      amount: string;
    }) => (
      input: Request,
    ) => Promise<
      | { status: 402; challenge: Response }
      | { status: 200; withReceipt: (response: Response) => Response }
    >;
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
