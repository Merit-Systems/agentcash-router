import { type FlowCtx, runHandlerOnly } from '../steps/index.js';

export async function runUnprotectedFlow(ctx: FlowCtx): Promise<Response> {
  return runHandlerOnly(ctx, null, undefined);
}
