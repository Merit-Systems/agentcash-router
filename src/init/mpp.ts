import type { Client } from 'viem';
import type { RouterConfig } from '../types.js';
import type { RouterDeps } from '../protocols/types.js';
import type { KvStore } from '../kv-store/index.js';
import { firePluginHook, type PluginContext, type RouterPlugin } from '../plugin/index.js';
import { getMppxRequestContext, getMppxStreamingContext } from './mppx.js';
import { createKvMppStore } from '../kv-store/index.js';
import { DEFAULT_TEMPO_RPC_URL } from '../constants.js';

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
    // viem/tempo/chains is the canonical Tempo entrypoint (mppx moved off viem/chains in 0.6.27).
    const { tempo: tempoChain } = await import('viem/tempo/chains');
    const { privateKeyToAccount } = await import('viem/accounts');

    const rpcUrl = config.mpp.rpcUrl ?? process.env.TEMPO_RPC_URL ?? DEFAULT_TEMPO_RPC_URL;
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
      ...(mppConfig.feePayerPolicy ? { feePayerPolicy: mppConfig.feePayerPolicy } : {}),
      ...(mppConfig.session?.settlementSchedule
        ? { settlementSchedule: mppConfig.session.settlementSchedule }
        : {}),
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
    subscribePaymentFailedAlerts(config.plugin, [primary, streaming]);

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

/** Structural view of mppx's instance-level server events (payment.failed). */
interface MppxPaymentFailedEvents {
  onPaymentFailed?: (
    handler: (payload: {
      error?: { name?: string; message?: string; status?: number; type?: string; hint?: string };
      credential?: { source?: string } | null;
      method?: { name?: string; intent?: string };
    }) => void,
  ) => unknown;
}

/**
 * Forward mppx's `payment.failed` server events to `plugin.onAlert`, so
 * verification failures inside mppx (sponsor policy, RPC rejections, invalid
 * credentials) surface through the plugin instead of only mppx's own
 * `console.error`. Instance-level events have no originating request, so the
 * context is a synthetic `requestId: 'mppx'`.
 */
export function subscribePaymentFailedAlerts(
  plugin: RouterPlugin | undefined,
  instances: Array<unknown | null>,
): void {
  if (!plugin?.onAlert) return;

  const ctx: PluginContext = {
    requestId: 'mppx',
    route: 'mpp',
    walletAddress: null,
    clientId: null,
    sessionId: null,
    verifiedWallet: null,
    setVerifiedWallet() {},
  };

  for (const instance of instances) {
    const events = instance as MppxPaymentFailedEvents | null;
    if (typeof events?.onPaymentFailed !== 'function') continue;
    events.onPaymentFailed((payload) => {
      try {
        const error = payload?.error ?? {};
        firePluginHook(plugin, 'onAlert', ctx, {
          level: (error.status ?? 402) >= 500 ? 'error' : 'warn',
          message: `MPP payment failed: ${error.message ?? error.name ?? 'unknown error'}`,
          route: 'mpp',
          meta: {
            ...(payload?.method
              ? { method: `${payload.method.name}/${payload.method.intent}` }
              : {}),
            ...(error.type ? { errorType: error.type } : {}),
            ...(error.status !== undefined ? { status: error.status } : {}),
            ...(error.hint ? { hint: error.hint } : {}),
            ...(payload?.credential?.source ? { payer: payload.credential.source } : {}),
          },
        });
      } catch {
        /* never let telemetry break payment handling */
      }
    });
  }
}
