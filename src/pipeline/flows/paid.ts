import type { NextResponse } from 'next/server';
import { type FlowCtx } from '../steps/index.js';
import { runDynamicPaidFlow } from './dynamic/dynamic-paid.js';
import { runStaticPaidFlow } from './static/static-paid.js';

export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const handlerCharged = ctx.routeEntry.billing !== 'exact';
  return handlerCharged ? runDynamicPaidFlow(ctx) : runStaticPaidFlow(ctx);
}
