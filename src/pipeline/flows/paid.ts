import { type FlowCtx } from '../steps/index.js';
import { runDynamicPaidFlow } from './dynamic-paid.js';
import { runStaticPaidFlow } from './static-paid.js';

export async function runPaidFlow(ctx: FlowCtx): Promise<Response> {
  const handlerCharged = ctx.routeEntry.billing !== 'exact';
  return handlerCharged ? runDynamicPaidFlow(ctx) : runStaticPaidFlow(ctx);
}
