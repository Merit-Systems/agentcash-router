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

export interface ServiceRouter {
  route(key: string): RouteBuilder;
  wellKnown(options?: WellKnownOptions): (request: NextRequest) => Promise<NextResponse>;
  openapi(options: OpenAPIOptions): (request: NextRequest) => Promise<NextResponse>;
  monitors(): MonitorEntry[];
  registry: RouteRegistry;
}

// ---------------------------------------------------------------------------
// createRouter
// ---------------------------------------------------------------------------

export function createRouter(config: RouterConfig): ServiceRouter {
  const registry = new RouteRegistry();
  const nonceStore = config.siwx?.nonceStore ?? new MemoryNonceStore();
  const network = config.network ?? 'eip155:8453';
  const baseUrl =
    typeof globalThis.process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000')
      : 'http://localhost:3000';

  // Fire plugin init
  if (config.plugin?.init) {
    try {
      config.plugin.init({ origin: baseUrl });
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
    mppConfig: config.mpp,
  };

  // x402 server init — fully async to avoid dynamic require() which breaks
  // Turbopack's __require polyfill. Errors stored in deps.x402InitError for
  // clear request-time messaging (e.g. "CDP_API_KEY_ID not set" instead of
  // a generic "server not initialized"). Every request handler awaits
  // deps.initPromise before touching deps.x402Server.
  deps.initPromise = (async () => {
    try {
      const { createX402Server } = await import('./server.js');
      const result = await createX402Server(config);
      deps.x402Server = result.server;
      await result.initPromise;
    } catch (err: unknown) {
      deps.x402Server = null;
      deps.x402InitError = err instanceof Error ? err.message : String(err);
    }
  })();

  const pricesKeys = config.prices ? Object.keys(config.prices) : undefined;

  return {
    route(key: string): RouteBuilder {
      const builder = new RouteBuilder(key, registry, deps);

      // Auto-apply pricing from prices map
      if (config.prices && key in config.prices) {
        return builder.paid(config.prices[key]) as unknown as RouteBuilder;
      }

      return builder;
    },

    wellKnown(options?: WellKnownOptions) {
      return createWellKnownHandler(registry, baseUrl, pricesKeys, options);
    },

    openapi(options: OpenAPIOptions) {
      return createOpenAPIHandler(registry, baseUrl, pricesKeys, options);
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
} from './types.js';

export { consolePlugin } from './plugin.js';
export type {
  RouterPlugin,
  PluginContext,
  RequestMeta,
  PaymentEvent,
  SettlementEvent,
  ResponseMeta,
  ErrorEvent,
} from './plugin.js';

export type { NonceStore } from './auth/nonce.js';
export { MemoryNonceStore } from './auth/nonce.js';
export { RouteBuilder } from './builder.js';
export { RouteRegistry } from './registry.js';
