import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { RouterConfig } from './types.js';
import type { RouteDefinition, RouteMethod } from './types.js';
import type { OrchestrateDeps } from './pipeline/orchestrate.js';
import { RouteRegistry } from './registry.js';
import { RouteBuilder } from './builder.js';
import {
  MemoryNonceStore,
  MemoryEntitlementStore,
  createKvNonceStore,
  createKvEntitlementStore,
  resolveKvStore,
} from './kv-store/index.js';
import { createWellKnownHandler } from './discovery/well-known.js';
import { createOpenAPIHandler } from './discovery/openapi.js';
import { createLlmsTxtHandler } from './discovery/llms-txt.js';
import { getConfiguredX402Accepts } from './protocols/x402/accepts.js';
import { BASE_NETWORK } from './constants.js';
import {
  RouterConfigError,
  formatRouterConfigIssues,
  getRouterConfigIssues,
} from './config/index.js';
import { initX402 } from './init/x402.js';
import { initMpp } from './init/mpp.js';

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
    ? RouteBuilder<undefined, undefined, undefined, true, false, false>
    : RouteBuilder<undefined, undefined, undefined, false, false, false>;
  wellKnown(): (request: NextRequest) => Promise<NextResponse>;
  openapi(): (request: NextRequest) => Promise<NextResponse>;
  llmsTxt(): (request: NextRequest) => Promise<NextResponse>;
  monitors(): MonitorEntry[];
  registry: RouteRegistry;
}

export function createRouter<const P extends Record<string, string> = Record<never, string>>(
  config: RouterConfig & { prices?: P },
): ServiceRouter<Extract<keyof P, string>> {
  const registry = new RouteRegistry();
  const kvStore = resolveKvStore(config.kvStore);
  const nonceStore = kvStore ? createKvNonceStore(kvStore) : new MemoryNonceStore();
  const entitlementStore = kvStore
    ? createKvEntitlementStore(kvStore)
    : new MemoryEntitlementStore();
  const network = config.network ?? BASE_NETWORK;
  const x402Accepts = getConfiguredX402Accepts(config);
  const configIssues = getRouterConfigIssues(config, {
    requireCdpKeys: process.env.NODE_ENV === 'production',
  });
  const baseUrlIssue = configIssues.find((issue) => issue.code === 'missing_base_url');
  if (baseUrlIssue) throw new RouterConfigError([baseUrlIssue]);

  const emptyProtocolsIssue = configIssues.find((issue) => issue.code === 'empty_protocols');
  if (emptyProtocolsIssue) throw new RouterConfigError([emptyProtocolsIssue]);

  const protocolConfigIssues = configIssues.filter(
    (issue) => issue.code !== 'missing_base_url' && issue.code !== 'empty_protocols',
  );
  const x402ConfigIssues = protocolConfigIssues.filter((issue) => issue.protocol === 'x402');
  const mppConfigIssues = protocolConfigIssues.filter((issue) => issue.protocol === 'mpp');
  const x402ConfigError =
    x402ConfigIssues.length > 0 ? formatRouterConfigIssues(x402ConfigIssues) : undefined;
  const mppConfigError =
    mppConfigIssues.length > 0 ? formatRouterConfigIssues(mppConfigIssues) : undefined;

  if (protocolConfigIssues.length > 0) {
    for (const issue of protocolConfigIssues) console.error(`[router] ${issue.message}`);
    if (process.env.NODE_ENV === 'production') {
      throw new RouterConfigError(protocolConfigIssues);
    }
  }

  const resolvedBaseUrl = config.baseUrl.replace(/\/+$/, '');

  if (config.plugin?.init) {
    try {
      const result = config.plugin.init({ origin: resolvedBaseUrl });
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {});
      }
    } catch {
      /* non-fatal */
    }
  }

  const deps: OrchestrateDeps = {
    x402Server: null,
    initPromise: Promise.resolve(),
    plugin: config.plugin,
    nonceStore,
    entitlementStore,
    payeeAddress: config.payeeAddress ?? '',
    mppRecipient: config.mpp?.recipient ?? config.payeeAddress,
    network,
    x402FacilitatorsByNetwork: undefined,
    x402Accepts,
    mppx: null,
    tempoClient: null,
    mppSessionConfig: config.mpp?.session
      ? { depositMultiplier: config.mpp.session.depositMultiplier ?? 10 }
      : null,
  };

  deps.initPromise = (async () => {
    const x402Result = await initX402(config, x402ConfigError);
    deps.x402Server = x402Result.server ?? null;
    deps.x402FacilitatorsByNetwork = x402Result.facilitatorsByNetwork;
    if (x402Result.initError) deps.x402InitError = x402Result.initError;

    const mppResult = await initMpp(config, resolvedBaseUrl, kvStore, mppConfigError);
    deps.mppx = mppResult.mppx ?? null;
    deps.tempoClient = mppResult.tempoClient ?? null;
    if (mppResult.initError) {
      deps.mppInitError = mppResult.initError;
      console.error(`[router] MPP initialization failed: ${mppResult.initError}`);
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

function normalizePath(path: string): string {
  let normalized = path.trim();
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/^api\/+/, '');
  return normalized.replace(/\/+$/, '');
}

export { HttpError } from './types.js';
export {
  BASE_NETWORK,
  SOLANA_MAINNET_NETWORK,
  TEMPO_USDC_CURRENCY,
  ZERO_EVM_ADDRESS,
} from './constants.js';
export {
  RouterConfigError,
  formatRouterConfigIssues,
  getRouterConfigIssues,
  mppFromEnv,
  paidOptionsForProtocols,
  validateRouterConfig,
  x402AcceptsFromEnv,
} from './config/index.js';
export type {
  RouterConfigIssue,
  RouterConfigIssueCode,
  RouterConfigValidationOptions,
  RouterEnv,
} from './config/index.js';
export type {
  HandlerContext,
  StreamingHandlerContext,
  RouterConfig,
  DiscoveryConfig,
  RouteEntry,
  PricingConfig,
  PaidOptions,
  MppProtocolInfo,
  ProtocolType,
  AuthMode,
  AlertFn,
  AlertLevel,
  AlertEvent,
  HandlerPaymentContext,
  SettlementLifecycle,
  SettlementLifecycleContext,
  SettlementSettledContext,
  SettledHandlerErrorContext,
  SettlementErrorContext,
  TierConfig,
  PaymentStatus,
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

export { consolePlugin } from './plugin/index.js';
export type {
  RouterPlugin,
  PluginContext,
  RequestMeta,
  AuthEvent,
  PaymentEvent,
  SettlementEvent,
  ResponseMeta,
  ErrorEvent,
} from './plugin/index.js';

export type {
  KvStore,
  KvChange,
  NonceStore,
  KvNonceStoreOptions,
  EntitlementStore,
  KvEntitlementStoreOptions,
  KvMppStoreOptions,
} from './kv-store/index.js';
export {
  withPrefix,
  MemoryNonceStore,
  createKvNonceStore,
  SIWX_CHALLENGE_EXPIRY_MS,
  MemoryEntitlementStore,
  createKvEntitlementStore,
  createKvMppStore,
} from './kv-store/index.js';
export type { SiwxErrorCode } from './auth/siwx.js';
export { SIWX_ERROR_MESSAGES } from './auth/siwx.js';
export { RouteBuilder } from './builder.js';
export { RouteRegistry } from './registry.js';
