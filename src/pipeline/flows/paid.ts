import type { NextResponse } from 'next/server';
import { type FlowCtx } from '../context/index.js';
import { runDynamicPaidFlow } from './dynamic/dynamic-paid.js';
import { runStaticPaidFlow } from './static/static-paid.js';

/**
 * Paid-route dispatcher. `routeEntry.dynamicPrice` is known at registration
 * time, so the choice between dynamic and static lifecycles is made here once
 * — each helper owns its full pipeline from auth gate to settlement with no
 * shared prefix.
 */
export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const dynamicPrice = ctx.routeEntry.dynamicPrice ?? false;
  switch (dynamicPrice) {
    case true:
      return runDynamicPaidFlow(ctx);
    case false:
      return runStaticPaidFlow(ctx);
  }
}
