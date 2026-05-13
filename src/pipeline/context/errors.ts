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
