export interface NonceStore {
  check(nonce: string): Promise<boolean>;
}

export class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>();

  async check(nonce: string): Promise<boolean> {
    this.evict();
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, Date.now() + 5 * 60 * 1000);
    return true;
  }

  private evict() {
    const now = Date.now();
    for (const [n, exp] of this.seen) {
      if (exp < now) this.seen.delete(n);
    }
  }
}
