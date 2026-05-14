import type { NextRequest, NextResponse } from 'next/server';
import type { ChargeContext } from '../../pricing/charge-context.js';
import type { HandlerContext, HandlerPaymentContext, RouteEntry } from '../../types.js';
import type { RouterDeps } from '../../protocols/types.js';
export type { RouterDeps } from '../../protocols/types.js';
import type { PluginContext, RequestMeta } from '../../plugin/index.js';
import type { ReportFn } from '../../plugin/reporter.js';

export interface FlowCtx {
  routeEntry: RouteEntry;
  handler: (ctx: HandlerContext) => Promise<unknown> | AsyncIterable<unknown>;
  deps: RouterDeps;
  request: NextRequest;
  meta: RequestMeta;
  pluginCtx: PluginContext;
  report: ReportFn;
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
