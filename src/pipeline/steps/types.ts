import type { ChargeContext } from '../../pricing/metered-charge.js';
import type { UptoChargeContext } from '../../pricing/upto-charge.js';
import type { HandlerContext, HandlerPaymentContext, RouteEntry } from '../../types.js';
import type { RouterDeps } from '../../protocols/types.js';
export type { RouterDeps } from '../../protocols/types.js';
import type { PluginContext, RequestMeta } from '../../plugin/index.js';
import type { ReportFn } from '../../plugin/reporter.js';

export interface FlowCtx {
  routeEntry: RouteEntry;
  handler: (ctx: HandlerContext) => Promise<unknown> | AsyncIterable<unknown>;
  deps: RouterDeps;
  request: Request;
  meta: RequestMeta;
  pluginCtx: PluginContext;
  report: ReportFn;
  query: unknown;
  /** Path-template params matched from the route's own `{param}` segments. */
  params: Record<string, string>;
}

export type ParseBodyResult = { ok: true; data: unknown } | { ok: false; response: Response };

export type StaticRequestResult = {
  response: Response;
  rawResult: unknown;
  handlerError?: unknown;
};

export type DynamicRequestResult = {
  kind: 'request';
  response: Response;
  rawResult: unknown;
  handlerError?: unknown;
  /** Present when the route is `.upTo()`; bill the accumulated total instead of tickCost. */
  uptoContext?: UptoChargeContext;
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
  response: Response;
  rawResult: unknown;
  handlerError?: unknown;
}
