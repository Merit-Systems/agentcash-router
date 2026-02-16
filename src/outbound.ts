import type { OutboundConfig } from './types.js';
import { getUsdcBalance } from './usdc.js';
import { retryPayment } from './retry.js';
import { withCronAuth } from './cron.js';

export class OutboundClient {
  private readonly config: Required<OutboundConfig>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(config: OutboundConfig) {
    this.config = {
      walletKey: config.walletKey,
      lowBalanceThreshold: config.lowBalanceThreshold ?? 0.25,
      alertUrl: config.alertUrl ?? '',
      rpcUrl: config.rpcUrl ?? 'https://mainnet.base.org',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { x402Client, x402HTTPClient } = await import('@x402/core/client');
        const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
        const { privateKeyToAccount } = await import('viem/accounts');

        const account = privateKeyToAccount(this.config.walletKey as `0x${string}`);
        const coreClient = new x402Client();
        registerExactEvmScheme(coreClient, { signer: account });
        return new x402HTTPClient(coreClient);
      })();
    }
    return this.clientPromise;
  }

  async pay(
    url: string,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<Response> {
    const httpClient = await this.getClient();
    const method = options?.method?.toUpperCase() ?? 'GET';
    const extraHeaders: Record<string, string> = { ...options?.headers };

    if (options?.body !== undefined) {
      extraHeaders['content-type'] = 'application/json';
    }

    const initial = await fetch(url, {
      method,
      headers: extraHeaders,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (initial.status !== 402) {
      return initial;
    }

    const initialBody = await initial.json();

    return retryPayment(async () => {
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name: string) => initial.headers.get(name),
        initialBody,
      );
      const payload = await httpClient.createPaymentPayload(paymentRequired);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

      const response = await fetch(url, {
        method,
        headers: { ...extraHeaders, ...paymentHeaders },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Outbound payment failed (${response.status}): ${text}`);
      }

      return response;
    });
  }

  async balance(): Promise<number> {
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(this.config.walletKey as `0x${string}`);
    return getUsdcBalance(account.address, this.config.rpcUrl);
  }

  async checkAndAlert(): Promise<{ balance: number; alerted: boolean }> {
    const balance = await this.balance();
    let alerted = false;

    if (balance < this.config.lowBalanceThreshold && this.config.alertUrl) {
      try {
        await fetch(this.config.alertUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            level: 'warn',
            message: `Outbound wallet balance low: $${balance.toFixed(2)} (threshold: $${this.config.lowBalanceThreshold})`,
            balance,
            threshold: this.config.lowBalanceThreshold,
          }),
        });
        alerted = true;
      } catch {
        // Alert delivery is best-effort
      }
    }

    return { balance, alerted };
  }
}

export function createBalanceCheckHandler(
  client: OutboundClient,
): (request: Request) => Promise<Response> {
  return withCronAuth(async () => {
    try {
      const result = await client.checkAndAlert();
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  });
}
