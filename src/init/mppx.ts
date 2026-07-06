import type { Mppx as MppxNS, Transport } from 'mppx/server';
import type { RouterConfig } from '../types.js';
import type { MppxMiddleware } from '../protocols/mpp/middleware-types.js';

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

export type MppxRequestContext = MppxNS.Mppx<MppxNS.Methods, Transport.Http> & {
  charge: ChargeMethod;
  session?: SessionMethod<Transport.Http>;
};

export type MppxStreamingContext = MppxNS.Mppx<MppxNS.Methods, Transport.Sse> & {
  session: SessionMethod<Transport.Sse>;
};

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
        ...(mppConfig.feePayerPolicy ? { feePayerPolicy: mppConfig.feePayerPolicy } : {}),
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
