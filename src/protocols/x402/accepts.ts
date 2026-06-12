import type {
  PayToConfig,
  RouteEntry,
  RouterConfig,
  X402AcceptConfig,
  X402ResolvedAccept,
} from '../../types.js';
import { BASE_MAINNET_NETWORK } from '../../constants.js';

async function resolvePayToValue(
  payTo: PayToConfig | undefined,
  request: Request,
  fallback: string,
  body: unknown,
  network: string,
): Promise<string> {
  if (!payTo) return fallback;
  if (typeof payTo === 'string') return payTo;
  return payTo(request, body, network);
}

export function getConfiguredX402Accepts(config: RouterConfig): X402AcceptConfig[] {
  if (config.x402?.accepts?.length) {
    return [...config.x402.accepts];
  }

  return [
    {
      scheme: 'exact',
      network: config.network ?? BASE_MAINNET_NETWORK,
      payTo: config.payeeAddress,
    },
  ];
}

export function getConfiguredX402Networks(config: RouterConfig): string[] {
  return [...new Set(getConfiguredX402Accepts(config).map((accept) => accept.network))];
}

/**
 * Narrow the server-wide accept list to the schemes a single route can honor:
 * `.upTo()` routes advertise only `upto` accepts, every other route advertises
 * only non-`upto` accepts. Without this, a fixed-price route would offer an
 * `upto` requirement the CDP facilitator can't complete (missing
 * `facilitatorAddress`), and `.upTo()` routes would offer an unfillable `exact`.
 */
export function selectRouteAccepts(
  accepts: readonly X402AcceptConfig[],
  routeEntry: Pick<RouteEntry, 'billing'>,
): X402AcceptConfig[] {
  return routeEntry.billing === 'upto'
    ? accepts.filter((accept) => accept.scheme === 'upto')
    : accepts.filter((accept) => (accept.scheme ?? 'exact') !== 'upto');
}

export async function resolveX402Accepts(
  request: Request,
  routeEntry: Pick<RouteEntry, 'payTo'>,
  accepts: readonly X402AcceptConfig[],
  fallbackPayTo: string,
  body?: unknown,
): Promise<X402ResolvedAccept[]> {
  return Promise.all(
    accepts.map(async (accept) => ({
      network: accept.network,
      scheme: accept.scheme ?? 'exact',
      payTo: await resolvePayToValue(
        routeEntry.payTo ?? accept.payTo,
        request,
        fallbackPayTo,
        body,
        accept.network,
      ),
      ...(accept.asset ? { asset: accept.asset } : {}),
      ...(accept.decimals !== undefined ? { decimals: accept.decimals } : {}),
      ...(accept.maxTimeoutSeconds !== undefined
        ? { maxTimeoutSeconds: accept.maxTimeoutSeconds }
        : {}),
      ...(accept.extra ? { extra: accept.extra } : {}),
    })),
  );
}
