import type { HandlerPaymentContext } from '../../types.js';
import type { FlowCtx, SettleScope } from './types.js';

/**
 * Build the SettlementLifecycleContext object passed to user-facing settlement
 * hooks. Shared by all four hook runners.
 */
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
