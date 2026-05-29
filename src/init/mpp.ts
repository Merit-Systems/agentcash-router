import type { Client } from 'viem';
import type { MppStripeConfig, RouterConfig } from '../types.js';
import type { RouterDeps } from '../protocols/types.js';
import type { KvStore } from '../kv-store/index.js';
import { getMppxRequestContext, getMppxStreamingContext } from './mppx.js';
import { createKvMppStore } from '../kv-store/index.js';
import { TEMPO_USDC_ADDRESS } from '../constants.js';

type MppxField = NonNullable<RouterDeps['mppx']>;
type ChargeMiddleware = MppxField['charge'];

export interface MppInitResult {
  mppx?: MppxField;
  tempoClient?: Client;
  initError?: string;
}

export async function initMpp(
  config: RouterConfig,
  resolvedBaseUrl: string,
  kvStore: KvStore | undefined,
  configError?: string,
): Promise<MppInitResult> {
  if (configError) return { initError: configError };
  if (!config.mpp) return {};

  if (config.mpp.provider === 'stripe') {
    return initStripeMpp(config.mpp, resolvedBaseUrl);
  }

  try {
    const { Mppx, tempo } = await import('mppx/server');
    const { createClient, http } = await import('viem');
    const { tempo: tempoChain } = await import('viem/chains');
    const { privateKeyToAccount } = await import('viem/accounts');

    const rpcUrl = (config.mpp.rpcUrl ?? process.env.TEMPO_RPC_URL)!;
    const tempoClient = createClient({ chain: tempoChain, transport: http(rpcUrl) });
    const getClient = async () => tempoClient;

    const operatorAccount = config.mpp.operatorKey
      ? privateKeyToAccount(config.mpp.operatorKey as `0x${string}`)
      : undefined;
    const feePayerAccount = config.mpp.feePayerKey
      ? privateKeyToAccount(config.mpp.feePayerKey as `0x${string}`)
      : undefined;

    const resolvedStore = kvStore ? await createKvMppStore(kvStore) : undefined;

    const realm = new URL(resolvedBaseUrl).host;
    const mppConfig = config.mpp;
    const sessionEnabled = !!(mppConfig.session && operatorAccount);
    const sharedSessionParams = {
      currency: mppConfig.currency as `0x${string}`,
      decimals: 6,
      recipient: (mppConfig.recipient ?? config.payeeAddress) as `0x${string}`,
      getClient,
      ...(operatorAccount ? { account: operatorAccount } : {}),
      ...(feePayerAccount ? { feePayer: feePayerAccount } : {}),
      ...(resolvedStore ? { store: resolvedStore } : {}),
    };
    const mppxArgs = {
      Mppx,
      tempo,
      mppConfig,
      payeeAddress: config.payeeAddress ?? '',
      getClient,
      feePayerAccount,
      resolvedStore,
      sessionEnabled,
      sharedSessionParams,
      realm,
    };
    const primary = getMppxRequestContext(mppxArgs);
    const streaming = getMppxStreamingContext(mppxArgs);

    const mppx: MppxField = {
      charge: primary.charge,
      ...(primary.session ? { sessionRequest: primary.session } : {}),
      ...(streaming?.session ? { sessionStream: streaming.session } : {}),
    };

    return { mppx, tempoClient };
  } catch (err) {
    return { initError: err instanceof Error ? err.message : String(err) };
  }
}

async function initStripeMpp(
  mppConfig: MppStripeConfig,
  resolvedBaseUrl: string,
): Promise<MppInitResult> {
  try {
    const { Mppx, tempo } = await import('mppx/server');
    const { Credential } = await import('mppx');
    const stripeModule = (await import('stripe')) as {
      default: new (...args: unknown[]) => StripeClientShape;
    };
    const Stripe = stripeModule.default;

    const stripeClient = new Stripe(mppConfig.stripeSecretKey, {
      apiVersion: mppConfig.stripeApiVersion ?? '2026-03-04.preview',
    }) as StripeClientShape;

    const currency = (mppConfig.currency ?? TEMPO_USDC_ADDRESS) as `0x${string}`;
    const realm = new URL(resolvedBaseUrl).host;

    const charge: ChargeMiddleware = (args) => async (request) => {
      const recipient = await resolveStripeRecipient(stripeClient, request, args.amount);
      const instance = Mppx.create({
        methods: [
          tempo.charge({ currency, recipient } as unknown as Parameters<typeof tempo.charge>[0]),
        ] as Parameters<typeof Mppx.create>[0]['methods'],
        secretKey: mppConfig.secretKey,
        realm,
      });
      return (instance as unknown as { charge: ChargeMiddleware }).charge(args)(request);
    };

    function readCredentialRecipient(request: Request): `0x${string}` | undefined {
      try {
        const credential = Credential.fromRequest(request);
        const challenge = (
          credential as { challenge?: { request?: { recipient?: string } } } | null
        )?.challenge;
        const recipient = challenge?.request?.recipient;
        return recipient ? (recipient as `0x${string}`) : undefined;
      } catch {
        return undefined;
      }
    }

    async function resolveStripeRecipient(
      stripe: StripeClientShape,
      request: Request,
      amount: string,
    ): Promise<`0x${string}`> {
      const existing = readCredentialRecipient(request);
      if (existing) return existing;

      // Stripe `amount` is the smallest currency unit (cents). Round half-up to avoid
      // sub-cent precision loss for fractional pricing (e.g. "0.015" → 2¢).
      const cents = Math.max(1, Math.round(Number(amount) * 100));
      const pi = await stripe.paymentIntents.create({
        amount: cents,
        currency: 'usd',
        payment_method_types: ['crypto'],
        payment_method_data: { type: 'crypto' },
        payment_method_options: {
          crypto: { mode: 'deposit', deposit_options: { networks: ['tempo'] } },
        },
        confirm: true,
      });
      const address = pi.next_action?.crypto_display_details?.deposit_addresses?.tempo?.address;
      if (!address) {
        throw new Error(
          'Stripe PaymentIntent did not return a Tempo deposit address — verify that crypto deposits are enabled on the Stripe account.',
        );
      }
      return address as `0x${string}`;
    }

    return { mppx: { charge } };
  } catch (err) {
    return { initError: err instanceof Error ? err.message : String(err) };
  }
}

interface StripeClientShape {
  paymentIntents: {
    create(params: {
      amount: number;
      currency: string;
      payment_method_types: string[];
      payment_method_data: { type: string };
      payment_method_options: {
        crypto: { mode: 'deposit'; deposit_options: { networks: string[] } };
      };
      confirm: boolean;
    }): Promise<{
      next_action?: {
        crypto_display_details?: {
          deposit_addresses?: { tempo?: { address?: string } };
        };
      };
    }>;
  };
}
