const BACKOFF = [1000, 2000, 4000];

export async function retryPayment<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (attempt === maxAttempts - 1) throw err;
      await new Promise((r) => setTimeout(r, BACKOFF[attempt] ?? 4000));
    }
  }
  /* istanbul ignore next */
  throw new Error('unreachable');
}
