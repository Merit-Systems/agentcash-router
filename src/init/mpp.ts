import type { Client } from 'viem';
import type { RouterConfig } from '../types.js';
import type { RouterDeps } from '../pipeline/steps/index.js';
import type { KvStore } from '../kv-store/index.js';
import { getMppxRequestContext, getMppxStreamingContext } from './mppx.js';
import { createKvMppStore } from '../kv-store/index.js';

type MppxField = NonNullable<RouterDeps['mppx']>;

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

    if (config.mpp.session && operatorAccount) {
      assertOperatorMatchesRecipient(config, operatorAccount.address);
    }

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

function assertOperatorMatchesRecipient(config: RouterConfig, operatorAddress: string): void {
  const recipient = (config.mpp?.recipient ?? config.payeeAddress)?.toLowerCase();
  const opAddr = operatorAddress.toLowerCase();
  if (recipient && opAddr !== recipient) {
    throw new Error(
      `MPP session config mismatch: operator address ${operatorAddress} ` +
        `must equal recipient/payee ${recipient}. ` +
        `mppx's channel-close handler asserts sender === payee. ` +
        `Set mpp.operatorKey to the private key for ${recipient}, or set ` +
        `mpp.recipient/payeeAddress to ${operatorAddress}.`,
    );
  }
}
