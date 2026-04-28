import type {
  PayToConfig,
  RouteEntry,
  RouterConfig,
  X402AcceptConfig,
  X402ResolvedAccept,
} from './types.js';
import { BASE_NETWORK } from './constants.js';

async function resolvePayToValue(
  payTo: PayToConfig | undefined,
  request: Request,
  fallback: string,
  body?: unknown,
): Promise<string> {
  if (!payTo) return fallback;
  if (typeof payTo === 'string') return payTo;
  return payTo(request, body);
}

export function getConfiguredX402Accepts(config: RouterConfig): X402AcceptConfig[] {
  if (config.x402?.accepts?.length) {
    return [...config.x402.accepts];
  }

  return [
    {
      scheme: 'exact',
      network: config.network ?? BASE_NETWORK,
      payTo: config.payeeAddress,
    },
  ];
}

export function getConfiguredX402Networks(config: RouterConfig): string[] {
  return [...new Set(getConfiguredX402Accepts(config).map((accept) => accept.network))];
}

/**
 * x402 schemes that support post-work amount overrides at settle time.
 * Variable-price routes must restrict their accepts to this set, otherwise
 * the challenge can degrade to a fixed-amount scheme (e.g. `exact`) when
 * facilitator enrichment fails — the client signs for the cap, the server
 * tries to apply `payment.setAmount()` on settle, and upstream rejects with
 * `invalid_exact_evm_payload_authorization_value`.
 */
const OVERRIDE_CAPABLE_SCHEMES = new Set(['upto']);

export async function resolveX402Accepts(
  request: Request,
  routeEntry: Pick<RouteEntry, 'payTo' | 'variablePrice'>,
  accepts: readonly X402AcceptConfig[],
  fallbackPayTo: string,
  body?: unknown,
): Promise<X402ResolvedAccept[]> {
  const filtered = routeEntry.variablePrice
    ? accepts.filter((a) => OVERRIDE_CAPABLE_SCHEMES.has(a.scheme ?? 'exact'))
    : accepts;
  return Promise.all(
    filtered.map(async (accept) => ({
      network: accept.network,
      scheme: accept.scheme ?? 'exact',
      payTo: await resolvePayToValue(
        routeEntry.payTo ?? accept.payTo,
        request,
        fallbackPayTo,
        body,
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
