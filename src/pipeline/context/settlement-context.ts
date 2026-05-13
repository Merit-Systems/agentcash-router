import type { HandlerPaymentContext } from '../../types.js';
import type { FlowCtx, SettleScope } from './types.js';

export function settlementContext<TPayment extends HandlerPaymentContext>(
  ctx: FlowCtx,
  scope: SettleScope<TPayment>,
) {
  return {
    route: ctx.routeEntry.key,
    request: ctx.request,
    body: scope.body,
    wallet: scope.wallet,
    account: scope.account,
    payment: scope.payment,
    response: scope.response,
    result: scope.rawResult,
  };
}
