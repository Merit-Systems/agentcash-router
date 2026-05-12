import type { NextResponse } from 'next/server';
import { type FlowCtx } from '../context/index.js';
import { runDynamicPaidFlow } from './dynamic/dynamic-paid.js';
import { runStaticPaidFlow } from './static/static-paid.js';

export async function runPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const dynamicPrice = ctx.routeEntry.dynamicPrice ?? false;
  switch (dynamicPrice) {
    case true:
      return runDynamicPaidFlow(ctx);
    case false:
      return runStaticPaidFlow(ctx);
  }
}
