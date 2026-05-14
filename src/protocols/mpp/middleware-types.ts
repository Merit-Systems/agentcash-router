import type { Transport } from 'mppx/server';

export type MppxMiddlewareResponse<T extends Transport.AnyTransport> =
  | { status: 402; challenge: Transport.ChallengeOutputOf<T> }
  | { status: 200; withReceipt: Transport.WithReceipt<T> };

export type MppxMiddleware<TOptions, T extends Transport.AnyTransport> = (
  options: TOptions,
) => (input: Request) => Promise<MppxMiddlewareResponse<T>>;
