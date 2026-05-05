/**
 * Error inspection helpers used across the pipeline.
 *
 * The pipeline accepts both `HttpError` instances and the universal
 * `Object.assign(new Error(), { status })` pattern. These helpers normalize
 * either form into a status code and message.
 */

export function errorStatus(error: unknown, fallback: number): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : fallback;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function handlerFailureError(response: Response): Error & { status: number } {
  const message = response.statusText || `Handler returned HTTP ${response.status}`;
  return Object.assign(new Error(message), { status: response.status });
}
