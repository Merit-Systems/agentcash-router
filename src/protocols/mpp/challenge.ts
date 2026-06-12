import type { Transport } from 'mppx/server';
import { HEADERS } from '../../headers.js';
import type { ChallengeContribution } from '../types.js';
import type { MppxMiddlewareResponse } from './middleware-types.js';

type AnyMppxMiddlewareResponse =
  | MppxMiddlewareResponse<Transport.Http>
  | MppxMiddlewareResponse<Transport.Sse>;

/**
 * Shared MPP challenge builder: invokes the given mppx middleware and, when
 * it answers 402, lifts its WWW-Authenticate header into the router's
 * challenge contribution.
 *
 * Thrown errors intentionally propagate WITHOUT being reported here — the
 * pipeline's challenge boundary (`buildChallengeResponse`) reports every
 * strategy challenge failure once as 'critical'. Reporting here too would
 * double-count the same error.
 */
export async function buildMppChallengeContribution(
  invoke: () => Promise<AnyMppxMiddlewareResponse>,
): Promise<ChallengeContribution> {
  const result = await invoke();
  if (result.status === 402) {
    const wwwAuth = result.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
    if (wwwAuth) return { headers: { [HEADERS.WWW_AUTHENTICATE]: wwwAuth } };
  }
  return {};
}
