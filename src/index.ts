import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { RouterConfig } from './types.js';
import type { RouteDefinition, RouteMethod } from './types.js';
import type { OrchestrateDeps } from './orchestrate.js';
import { RouteRegistry } from './registry.js';
import { RouteBuilder } from './builder.js';
import { MemoryNonceStore } from './auth/nonce.js';
import { MemoryEntitlementStore } from './auth/entitlement.js';
import { createWellKnownHandler } from './discovery/well-known.js';
import { createOpenAPIHandler } from './discovery/openapi.js';
import { createLlmsTxtHandler } from './discovery/llms-txt.js';
import { getConfiguredX402Accepts } from './x402-config.js';
import { isEvmNetwork } from './protocols/evm.js';
import { isSolanaNetwork } from './protocols/solana.js';
// ---------------------------------------------------------------------------
// ServiceRouter
// ---------------------------------------------------------------------------

export interface MonitorEntry {
  provider: string;
  route: string;
  monitor: () => Promise<import('./types.js').QuotaInfo | null>;
  overage: import('./types.js').OveragePolicy;
  warn?: number;
  critical?: number;
}

export interface ServiceRouter<TPriceKeys extends string = never> {
  route<K extends string>(
    keyOrDefinition: K | RouteDefinition<K>,
  ): [K] extends [TPriceKeys]
    ? RouteBuilder<undefined, undefined, true, false, false>
    : RouteBuilder<undefined, undefined, false, false, false>;
  wellKnown(): (request: NextRequest) => Promise<NextResponse>;
  openapi(): (request: NextRequest) => Promise<NextResponse>;
  llmsTxt(): (request: NextRequest) => Promise<NextResponse>;
  monitors(): MonitorEntry[];
  registry: RouteRegistry;
}

// ---------------------------------------------------------------------------
// createRouter
// ---------------------------------------------------------------------------

export function createRouter<const P extends Record<string, string> = Record<never, string>>(
  config: RouterConfig & { prices?: P },
): ServiceRouter<Extract<keyof P, string>> {
  const registry = new RouteRegistry();
  const nonceStore = config.siwx?.nonceStore ?? new MemoryNonceStore();
  const entitlementStore = config.siwx?.entitlementStore ?? new MemoryEntitlementStore();
  const network = config.network ?? 'eip155:8453';
  const x402Accepts = getConfiguredX402Accepts(config);
  // baseUrl is required — the realm is load-bearing for payment matching and MPP indexing.
  // No auto-detection; consuming apps must explicitly set it.
  if (!config.baseUrl) {
    throw new Error(
      '[router] baseUrl is required in RouterConfig. ' +
        'Set it to your production domain (e.g., "https://api.example.com"). ' +
        'The realm is used for payment matching and must be correct.',
    );
  }

  // Empty protocols is a programming error — always throw.
  if (config.protocols && config.protocols.length === 0) {
    throw new Error(
      "RouterConfig.protocols cannot be empty. Omit the field to use default ['x402'] or specify protocols explicitly.",
    );
  }

  const resolvedBaseUrl = config.baseUrl.replace(/\/+$/, '');

  // Validate per-protocol config synchronously.
  let x402ConfigError: string | undefined;
  let mppConfigError: string | undefined;

  if (!config.protocols || config.protocols.includes('x402')) {
    if (x402Accepts.length === 0) {
      x402ConfigError = 'x402 requires at least one accept configuration.';
    } else if (x402Accepts.some((accept) => !accept.network)) {
      x402ConfigError = 'x402 accepts require a network.';
    } else if (x402Accepts.some((accept) => !isSupportedX402Network(accept.network))) {
      const unsupported = x402Accepts.find((accept) => !isSupportedX402Network(accept.network));
      x402ConfigError = `unsupported x402 network '${unsupported?.network}'. Use eip155:* or solana:*.`;
    } else if (
      x402Accepts.some((accept) => (accept.scheme ?? 'exact') !== 'exact' && !accept.asset)
    ) {
      x402ConfigError = 'non-exact x402 accepts require an asset.';
    } else if (
      x402Accepts.some(
        (accept) =>
          accept.decimals !== undefined &&
          (!Number.isInteger(accept.decimals) || accept.decimals < 0),
      )
    ) {
      x402ConfigError = 'x402 accept decimals must be a non-negative integer.';
    } else if (x402Accepts.some((accept) => !accept.payTo) && !config.payeeAddress) {
      x402ConfigError =
        'x402 requires payeeAddress in router config or payTo on every x402 accept.';
    }
  }

  if (config.protocols?.includes('mpp')) {
    if (!config.mpp) {
      mppConfigError =
        'protocols includes "mpp" but mpp config is missing. ' +
        'Add mpp: { secretKey, currency, recipient } to your router config.';
    } else if (!config.mpp.recipient && !config.payeeAddress) {
      mppConfigError =
        'MPP requires a recipient address. Set mpp.recipient or payeeAddress in your router config.';
    } else if (!(config.mpp.rpcUrl ?? process.env.TEMPO_RPC_URL)) {
      mppConfigError =
        'MPP requires an authenticated Tempo RPC URL. ' +
        'Set TEMPO_RPC_URL env var or pass rpcUrl in the mpp config object.';
    }
  }

  const allConfigErrors = [x402ConfigError, mppConfigError].filter(Boolean);
  if (allConfigErrors.length > 0) {
    for (const err of allConfigErrors) console.error(`[router] ${err}`);
    // Throw in production to fail `next build`. In development, errors are
    // stored per-protocol and surfaced as clean JSON 500s at request time.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(allConfigErrors.join('\n'));
    }
  }

  // Plugin init: non-fatal, but properly handle async rejections.
  // RouterPlugin.init may return void or Promise<void>.
  if (config.plugin?.init) {
    try {
      const result = config.plugin.init({ origin: resolvedBaseUrl });
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Plugin init failure is non-fatal
    }
  }

  const deps: OrchestrateDeps = {
    x402Server: null,
    initPromise: Promise.resolve(),
    plugin: config.plugin,
    nonceStore,
    entitlementStore,
    payeeAddress: config.payeeAddress ?? '',
    network,
    x402FacilitatorsByNetwork: undefined,
    x402Accepts,
    mppx: null,
    tempoClient: null,
  };

  // Async init — dynamic imports avoid require() which breaks Turbopack.
  // Config errors (caught above) skip runtime init and just set the error field.
  // Every request handler awaits deps.initPromise.
  deps.initPromise = (async () => {
    // ---- x402 ----
    if (x402ConfigError) {
      deps.x402InitError = x402ConfigError;
    } else {
      try {
        const { createX402Server } = await import('./server.js');
        const result = await createX402Server(config);
        deps.x402Server = result.server;
        deps.x402FacilitatorsByNetwork = result.facilitatorsByNetwork;
        await result.initPromise;
      } catch (err: unknown) {
        deps.x402Server = null;
        deps.x402InitError = err instanceof Error ? err.message : String(err);
      }
    }

    // ---- MPP ----
    if (mppConfigError) {
      deps.mppInitError = mppConfigError;
    } else if (config.mpp) {
      try {
        const { Mppx, tempo } = await import('mppx/server');
        const rpcUrl = (config.mpp.rpcUrl ?? process.env.TEMPO_RPC_URL)!;
        const { createClient, http } = await import('viem');
        const { tempo: tempoChain } = await import('viem/chains');
        deps.tempoClient = createClient({ chain: tempoChain, transport: http(rpcUrl) });
        const getClient = async () => deps.tempoClient!;

        let feePayerAccount: unknown;
        if (config.mpp.feePayerKey) {
          const { privateKeyToAccount } = await import('viem/accounts');
          feePayerAccount = privateKeyToAccount(config.mpp.feePayerKey as `0x${string}`);
        }

        let resolvedStore = config.mpp.store;
        if (!resolvedStore && config.mpp.useDefaultStore) {
          const kvUrl = process.env.KV_REST_API_URL;
          const kvToken = process.env.KV_REST_API_TOKEN;
          if (!kvUrl || !kvToken) {
            throw new Error(
              'mpp.useDefaultStore requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables. ' +
                'These are automatically set by Vercel KV.',
            );
          }
          const { Store } = await import('mppx');
          const { createUpstashRest } = await import('./upstash-rest.js');
          resolvedStore = Store.upstash(createUpstashRest(kvUrl, kvToken));
        }

        deps.mppx = Mppx.create({
          methods: [
            tempo.charge({
              currency: config.mpp.currency as `0x${string}`,
              recipient: (config.mpp.recipient ?? config.payeeAddress) as `0x${string}`,
              getClient,
              ...(feePayerAccount ? { feePayer: feePayerAccount } : {}),
              ...(resolvedStore ? { store: resolvedStore } : {}),
            } as Parameters<typeof tempo.charge>[0]),
          ],
          secretKey: config.mpp.secretKey,
          realm: new URL(resolvedBaseUrl).host,
        });
      } catch (err: unknown) {
        deps.mppx = null;
        deps.mppInitError = err instanceof Error ? err.message : String(err);
        console.error(`[router] MPP initialization failed: ${deps.mppInitError}`);
      }
    }
  })();

  const pricesKeys = config.prices ? Object.keys(config.prices) : undefined;

  return {
    route(keyOrDefinition) {
      const isDefinition = typeof keyOrDefinition !== 'string';
      if (config.strictRoutes && !isDefinition) {
        throw new Error(
          '[router] strictRoutes=true requires route({ path }) form. ' +
            "Replace route('my/key') with route({ path: 'my/key' }).",
        );
      }

      const definition = isDefinition
        ? keyOrDefinition
        : ({ path: keyOrDefinition, key: keyOrDefinition } as RouteDefinition<string>);

      const normalizedPath = normalizePath(definition.path);
      const key = definition.key ?? normalizedPath;
      if (config.strictRoutes && definition.key && definition.key !== definition.path) {
        throw new Error(
          `[router] strictRoutes=true forbids key/path divergence for route '${definition.path}'. ` +
            'Remove custom `key` or make it equal to `path`.',
        );
      }
      let builder = new RouteBuilder(key, registry, deps);
      builder = builder.path(normalizedPath);
      if (config.protocols) {
        builder._protocols = [...config.protocols];
      }
      if (definition.method) {
        builder = builder.method(definition.method as RouteMethod);
      }

      if (config.prices && key in config.prices) {
        return builder.paid(config.prices[key]) as never;
      }

      return builder as never;
    },

    wellKnown() {
      return createWellKnownHandler(registry, resolvedBaseUrl, pricesKeys, config.discovery);
    },

    openapi() {
      return createOpenAPIHandler(registry, resolvedBaseUrl, pricesKeys, config.discovery);
    },

    llmsTxt() {
      return createLlmsTxtHandler(config.discovery);
    },

    monitors(): MonitorEntry[] {
      const result: MonitorEntry[] = [];
      for (const [, entry] of registry.entries()) {
        if (entry.providerName && entry.providerConfig?.monitor) {
          result.push({
            provider: entry.providerName,
            route: entry.key,
            monitor: entry.providerConfig.monitor,
            overage: entry.providerConfig.overage ?? 'same-rate',
            warn: entry.providerConfig.warn,
            critical: entry.providerConfig.critical,
          });
        }
      }
      return result;
    },

    registry,
  };
}

function isSupportedX402Network(network: string): boolean {
  return isEvmNetwork(network) || isSolanaNetwork(network);
}

function normalizePath(path: string): string {
  let normalized = path.trim();
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/^api\/+/, '');
  return normalized.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { HttpError } from './types.js';
export type {
  HandlerContext,
  RouterConfig,
  DiscoveryConfig,
  RouteEntry,
  PricingConfig,
  PaidOptions,
  ProtocolType,
  AuthMode,
  AlertFn,
  AlertLevel,
  AlertEvent,
  TierConfig,
  ProviderConfig,
  ProviderQuotaEvent,
  QuotaInfo,
  QuotaLevel,
  OveragePolicy,
  X402Server,
  X402AcceptConfig,
  X402ResolvedAccept,
  X402RouterFacilitatorConfig,
  X402FacilitatorsConfig,
  X402FacilitatorTarget,
  PayToConfig,
} from './types.js';

export { consolePlugin } from './plugin.js';
export type {
  RouterPlugin,
  PluginContext,
  RequestMeta,
  AuthEvent,
  PaymentEvent,
  SettlementEvent,
  ResponseMeta,
  ErrorEvent,
} from './plugin.js';

export type { NonceStore, RedisNonceStoreOptions } from './auth/nonce.js';
export { MemoryNonceStore, createRedisNonceStore, SIWX_CHALLENGE_EXPIRY_MS } from './auth/nonce.js';
export type { EntitlementStore, RedisEntitlementStoreOptions } from './auth/entitlement.js';
export { MemoryEntitlementStore, createRedisEntitlementStore } from './auth/entitlement.js';
export type { SiwxErrorCode } from './auth/siwx.js';
export { SIWX_ERROR_MESSAGES } from './auth/siwx.js';
export { RouteBuilder } from './builder.js';
export { RouteRegistry } from './registry.js';
