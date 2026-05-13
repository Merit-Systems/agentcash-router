import type { ZodType } from 'zod';

export async function bufferBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export interface BodyValidationResult<T> {
  success: true;
  data: T;
}

export interface BodyValidationError {
  success: false;
  error: string;
  issues: unknown[];
}

export function validateBody<T>(
  parsed: unknown,
  schema: ZodType<T>,
): BodyValidationResult<T> | BodyValidationError {
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const err = result.error as unknown as Record<string, unknown>;
  const issues =
    'issues' in err
      ? (err.issues as unknown[])
      : [{ message: String(err.message ?? 'Validation failed') }];
  return {
    success: false,
    error: 'Validation failed',
    issues,
  };
}
