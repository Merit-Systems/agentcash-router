import type { NextResponse } from 'next/server';
import { type FlowCtx, runHandlerOnly } from '../context/index.js';

export async function runUnprotectedFlow(ctx: FlowCtx): Promise<NextResponse> {
  return runHandlerOnly(ctx, null, undefined);
}
