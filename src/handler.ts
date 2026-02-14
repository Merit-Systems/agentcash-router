import { NextResponse } from 'next/server';
import { HttpError } from './types.js';

export async function safeCallHandler(
  handler: (ctx: unknown) => Promise<unknown>,
  ctx: unknown,
): Promise<NextResponse> {
  try {
    const result = await handler(ctx);
    if (result instanceof Response) return result as unknown as NextResponse;
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
