import { HttpError } from '../types.js';

export async function safeCallHandler(
  handler: (ctx: unknown) => Promise<unknown>,
  ctx: unknown,
  options: { onError?: (error: unknown) => void } = {},
): Promise<Response> {
  try {
    const result = await handler(ctx);
    if (result instanceof Response) return result;
    return Response.json(result);
  } catch (error) {
    options.onError?.(error);
    const status =
      error instanceof HttpError
        ? error.status
        : typeof (error as Record<string, unknown>).status === 'number'
          ? ((error as Record<string, unknown>).status as number)
          : 500;
    const message = error instanceof Error ? error.message : 'Internal error';
    return Response.json({ success: false, error: message }, { status });
  }
}
