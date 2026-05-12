import type { NextRequest, NextResponse } from 'next/server';
import type { Transport } from 'mppx/server';
import type { ChargeContext } from '../../pricing/charge-context.js';
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

export type MppxMiddlewareResponse<T extends Transport.AnyTransport> =
  | { status: 402; challenge: Transport.ChallengeOutputOf<T> }
  | { status: 200; withReceipt: Transport.WithReceipt<T> };

export type MppxMiddleware<TOptions, T extends Transport.AnyTransport> = (
  options: TOptions,
) => (input: Request) => Promise<MppxMiddlewareResponse<T>>;

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

export interface FlowCtx {
  routeEntry: RouteEntry;
  handler: (ctx: HandlerContext) => Promise<unknown> | AsyncIterable<unknown>;
  deps: RouterDeps;
  request: NextRequest;
  meta: RequestMeta;
  pluginCtx: PluginContext;
}

export type ParseBodyResult = { ok: true; data: unknown } | { ok: false; response: NextResponse };

export type StaticRequestResult = {
  response: NextResponse;
  rawResult: unknown;
  handlerError?: unknown;
};

export type DynamicRequestResult = {
  kind: 'request';
  response: NextResponse;
  rawResult: unknown;
  handlerError?: unknown;
};

export type DynamicStreamResult = {
  kind: 'stream';
  source: AsyncIterable<unknown>;
  chargeContext: ChargeContext;
};

export type DynamicInvokeResult = DynamicRequestResult | DynamicStreamResult;

export interface SettleScope<TPayment extends HandlerPaymentContext = HandlerPaymentContext> {
  wallet: string;
  account: unknown;
  body: unknown;
  payment: TPayment;
  response: NextResponse;
  rawResult: unknown;
  handlerError?: unknown;
}
