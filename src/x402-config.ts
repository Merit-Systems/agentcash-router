import type {
  PayToConfig,
  RouteEntry,
  RouterConfig,
  X402AcceptConfig,
  X402ResolvedAccept,
} from './types.js';

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
      network: config.network ?? 'eip155:8453',
      payTo: config.payeeAddress,
    },
  ];
}

export function getConfiguredX402Networks(config: RouterConfig): string[] {
  return [...new Set(getConfiguredX402Accepts(config).map((accept) => accept.network))];
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
      payTo: await resolvePayToValue(accept.payTo ?? routeEntry.payTo, request, fallbackPayTo, body),
      ...(accept.asset ? { asset: accept.asset } : {}),
      ...(accept.decimals !== undefined ? { decimals: accept.decimals } : {}),
      ...(accept.maxTimeoutSeconds !== undefined
        ? { maxTimeoutSeconds: accept.maxTimeoutSeconds }
        : {}),
      ...(accept.extra ? { extra: accept.extra } : {}),
    })),
  );
}
