import type { TreasuryConfig } from './types.js';
import { USDC_DECIMALS, getUsdcBalance } from './usdc.js';
import { retryPayment } from './retry.js';
import { withCronAuth } from './cron.js';

export class TreasuryManager {
  private readonly config: Required<TreasuryConfig>;

  constructor(config: TreasuryConfig) {
    this.config = {
      operationalKey: config.operationalKey,
      treasuryAddress: config.treasuryAddress,
      buffer: config.buffer ?? 10,
      sweepThreshold: config.sweepThreshold ?? 20,
      rpcUrl: config.rpcUrl ?? 'https://mainnet.base.org',
    };
  }

  async balance(): Promise<number> {
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(this.config.operationalKey as `0x${string}`);
    return getUsdcBalance(account.address, this.config.rpcUrl);
  }

  async sweep(): Promise<{ swept: number; balance: number }> {
    const currentBalance = await this.balance();

    if (currentBalance < this.config.sweepThreshold) {
      return { swept: 0, balance: currentBalance };
    }

    const sweepAmount = currentBalance - this.config.buffer;
    if (sweepAmount <= 0) {
      return { swept: 0, balance: currentBalance };
    }

    const sweepUrl = new URL('https://x402scan.com/api/send');
    sweepUrl.searchParams.set('address', this.config.treasuryAddress);
    sweepUrl.searchParams.set('amount', sweepAmount.toFixed(USDC_DECIMALS));
    sweepUrl.searchParams.set('chain', 'base');

    const { x402Client, x402HTTPClient } = await import('@x402/core/client');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
    const { privateKeyToAccount } = await import('viem/accounts');

    const account = privateKeyToAccount(this.config.operationalKey as `0x${string}`);
    const coreClient = new x402Client();
    registerExactEvmScheme(coreClient, { signer: account });
    const httpClient = new x402HTTPClient(coreClient);

    await retryPayment(async () => {
      const initial = await fetch(sweepUrl.toString());
      if (initial.status !== 402) {
        if (!initial.ok) {
          const text = await initial.text();
          throw new Error(`Treasury sweep failed (${initial.status}): ${text}`);
        }
        return;
      }

      const initialBody = await initial.json();
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name: string) => initial.headers.get(name),
        initialBody,
      );
      const payload = await httpClient.createPaymentPayload(paymentRequired);
      const headers = httpClient.encodePaymentSignatureHeader(payload);
      const response = await fetch(sweepUrl.toString(), { headers });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Treasury sweep failed (${response.status}): ${text}`);
      }
    });

    const newBalance = await this.balance();
    return { swept: sweepAmount, balance: newBalance };
  }
}

export function createTreasurySweepHandler(
  manager: TreasuryManager,
): (request: Request) => Promise<Response> {
  return withCronAuth(async () => {
    try {
      const result = await manager.sweep();
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
