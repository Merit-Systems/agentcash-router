import type { ChargeContext } from '../../pricing/metered-charge.js';
import type { UptoChargeContext } from '../../pricing/upto-charge.js';
import type { HandlerContext, HandlerPaymentContext, RouteEntry } from '../../types.js';
import type { RouterDeps } from '../../protocols/types.js';
export type { RouterDeps } from '../../protocols/types.js';
import type { PluginContext, RequestMeta } from '../../plugin/index.js';
import type { ReportFn } from '../../plugin/reporter.js';
import type { RouteRegistry } from '../../registry.js';

/** Router-level routing context used to resolve `.nextStep()` targets to URLs at response time. */
export interface RouteRouting {
  registry: RouteRegistry;
  /** Origin URL, no trailing slash. */
  baseUrl: string;
  /** Route mount prefix, no slashes (`''` when mounted at root). */
  basePath: string;
}

export interface FlowCtx {
  routeEntry: RouteEntry;
  handler: (ctx: HandlerContext) => Promise<unknown> | AsyncIterable<unknown>;
  deps: RouterDeps;
  request: Request;
  meta: RequestMeta;
  pluginCtx: PluginContext;
  report: ReportFn;
  query: unknown;
  /** Path-template params matched from the route's own `{param}` template. */
  params: Record<string, string>;
  /** Present when the route was registered through a router; `null`/absent for bare `createRequestHandler` use (nextStep injection is skipped). */
  routing?: RouteRouting | null;
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
