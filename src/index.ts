import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { RouterConfig } from './types.js';
import type { OrchestrateDeps } from './orchestrate.js';
import type { WellKnownOptions } from './discovery/well-known.js';
import type { OpenAPIOptions } from './discovery/openapi.js';
import { RouteRegistry } from './registry.js';
import { RouteBuilder } from './builder.js';
import { MemoryNonceStore } from './auth/nonce.js';
import { createWellKnownHandler } from './discovery/well-known.js';
import { createOpenAPIHandler } from './discovery/openapi.js';

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
    key: K,
  ): [K] extends [TPriceKeys]
    ? RouteBuilder<undefined, undefined, true, false, false>
    : RouteBuilder<undefined, undefined, false, false, false>;
  wellKnown(options?: WellKnownOptions): (request: NextRequest) => Promise<NextResponse>;
  openapi(options: OpenAPIOptions): (request: NextRequest) => Promise<NextResponse>;
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
  const network = config.network ?? 'eip155:8453';
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

  if ((!config.protocols || config.protocols.includes('x402')) && !config.payeeAddress) {
    x402ConfigError = 'x402 requires payeeAddress in router config.';
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
    payeeAddress: config.payeeAddress,
    network,
    mppx: null,
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
        deps.mppx = Mppx.create({
          methods: [
            tempo.charge({
              currency: config.mpp.currency as `0x${string}`,
              recipient: (config.mpp.recipient ?? config.payeeAddress) as `0x${string}`,
              getClient: async () => {
                const { createClient, http } = await import('viem');
                const { tempo: tempoChain } = await import('viem/chains');
                return createClient({ chain: tempoChain, transport: http(rpcUrl) });
              },
            }),
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
    route(key) {
      const builder = new RouteBuilder(key, registry, deps);

      if (config.prices && key in config.prices) {
        const options = config.protocols ? { protocols: config.protocols } : undefined;
        return builder.paid(config.prices[key], options) as never;
      }

      return builder as never;
    },

    wellKnown(options?: WellKnownOptions) {
      return createWellKnownHandler(registry, resolvedBaseUrl, pricesKeys, options);
    },

    openapi(options: OpenAPIOptions) {
      return createOpenAPIHandler(registry, resolvedBaseUrl, pricesKeys, options);
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

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { HttpError } from './types.js';
export type {
  HandlerContext,
  RouterConfig,
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
export type { SiwxErrorCode } from './auth/siwx.js';
export { SIWX_ERROR_MESSAGES } from './auth/siwx.js';
export { RouteBuilder } from './builder.js';
export { RouteRegistry } from './registry.js';
