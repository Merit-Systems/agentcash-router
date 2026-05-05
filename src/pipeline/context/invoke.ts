import type { HandlerContext, HandlerPaymentContext } from '../../types.js';
import { firePluginHook } from '../../plugin.js';
import { safeCallHandler } from '../../handler.js';
import { parseQuery } from './parse-query.js';
import type { FlowCtx, InvokeResult } from './types.js';

/** Build the handler's HandlerContext and call it through safeCallHandler. */
export async function invoke(
  ctx: FlowCtx,
  wallet: string | null,
  account: unknown,
  body: unknown,
  payment: HandlerPaymentContext | null,
): Promise<InvokeResult> {
  const handlerCtx: HandlerContext = {
    body: body as never,
    query: parseQuery(ctx.request, ctx.routeEntry) as never,
    request: ctx.request,
    requestId: ctx.meta.requestId,
    route: ctx.routeEntry.key,
    wallet,
    payment,
    account,
    alert(level, message, alertMeta) {
      firePluginHook(ctx.deps.plugin, 'onAlert', ctx.pluginCtx, {
        level,
        message,
        route: ctx.routeEntry.key,
        meta: alertMeta,
      });
    },
    setVerifiedWallet: (addr) => ctx.pluginCtx.setVerifiedWallet(addr),
  };

  let rawResult: unknown;
  let handlerError: unknown;
  const response = await safeCallHandler(
    async (c) => {
      rawResult = await ctx.handler(c as HandlerContext);
      return rawResult;
    },
    handlerCtx,
    {
      onError(error) {
        handlerError = error;
      },
    },
  );

  return { response, rawResult, handlerError };
}
