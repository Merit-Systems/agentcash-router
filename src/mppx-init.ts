import type { Mppx as MppxNS, Transport } from 'mppx/server';
import type { RouterConfig } from './types.js';
import type { MppxMiddleware } from './pipeline/context/types.js';

type MppxModule = typeof import('mppx/server');

export interface MppxContextArgs {
  Mppx: MppxModule['Mppx'];
  tempo: MppxModule['tempo'];
  mppConfig: NonNullable<RouterConfig['mpp']>;
  payeeAddress: string;
  getClient: () => Promise<unknown>;
  feePayerAccount: unknown;
  resolvedStore: unknown;
  sessionEnabled: boolean;
  sharedSessionParams: Record<string, unknown>;
  realm: string;
}

type ChargeMethod = MppxMiddleware<{ amount: string }, Transport.Http>;
type SessionMethod<T extends Transport.AnyTransport> = MppxMiddleware<
  { amount: string; unitType?: string; suggestedDeposit?: string },
  T
>;

/**
 * Request-mode mppx instance, refined with the method shorthands we
 * register. Extends the native `Mppx.Mppx` instance type so consumers can
 * treat it as a real mppx context, but adds typed access to `charge` and
 * (optional) `session` rather than going through `mppx['tempo/charge']`.
 */
export type MppxRequestContext = MppxNS.Mppx<MppxNS.Methods, Transport.Http> & {
  charge: ChargeMethod;
  session?: SessionMethod<Transport.Http>;
};

/**
 * Streaming-mode mppx instance — same shape, but `session` returns SSE
 * responses. Always carries `session` (the instance is only built when
 * sessions are enabled).
 */
export type MppxStreamingContext = MppxNS.Mppx<MppxNS.Methods, Transport.Sse> & {
  session: SessionMethod<Transport.Sse>;
};

/**
 * Request-mode mppx instance: `tempo.charge` (static push-payment) plus the
 * non-SSE `tempo.session` (request-mode dynamic — one tick per request,
 * returned via a Payment-Receipt header). Session method is included only
 * when sessions are enabled (`config.mpp.session` + `feePayerAccount`).
 */
export function getMppxRequestContext(args: MppxContextArgs): MppxRequestContext {
  const {
    Mppx,
    tempo,
    mppConfig,
    payeeAddress,
    getClient,
    feePayerAccount,
    resolvedStore,
    sessionEnabled,
    sharedSessionParams,
    realm,
  } = args;
  const instance = Mppx.create({
    methods: [
      tempo.charge({
        currency: mppConfig.currency as `0x${string}`,
        recipient: (mppConfig.recipient ?? payeeAddress) as `0x${string}`,
        getClient,
        ...(feePayerAccount ? { feePayer: feePayerAccount } : {}),
        ...(resolvedStore ? { store: resolvedStore } : {}),
      } as unknown as Parameters<typeof tempo.charge>[0]),
      ...(sessionEnabled
        ? [
            tempo.session({
              ...sharedSessionParams,
              sse: false,
            } as unknown as Parameters<typeof tempo.session>[0]),
          ]
        : []),
    ] as Parameters<typeof Mppx.create>[0]['methods'],
    secretKey: mppConfig.secretKey,
    realm,
  });
  return instance as unknown as MppxRequestContext;
}

/**
 * Streaming-mode mppx instance: SSE-only `tempo.session` for async-generator
 * handlers (per-yield voucher events spliced into the SSE stream). Returns
 * `null` when sessions aren't enabled. Shares store/secretKey/realm with the
 * request-mode instance so channel state and challenge HMACs are
 * interchangeable.
 */
export function getMppxStreamingContext(args: MppxContextArgs): MppxStreamingContext | null {
  if (!args.sessionEnabled) return null;
  const { Mppx, tempo, mppConfig, sharedSessionParams, realm } = args;
  const instance = Mppx.create({
    methods: [
      tempo.session({
        ...sharedSessionParams,
        sse: true,
      } as unknown as Parameters<typeof tempo.session>[0]),
    ] as Parameters<typeof Mppx.create>[0]['methods'],
    secretKey: mppConfig.secretKey,
    realm,
  });
  return instance as unknown as MppxStreamingContext;
}
