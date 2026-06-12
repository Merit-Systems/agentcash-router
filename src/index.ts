import { Hono } from 'hono';
import type { RouterConfig } from './types.js';
import type { RouteDefinition, RouteMethod } from './types.js';
import type { RouterDeps } from './pipeline/orchestrate.js';
import { RouteRegistry } from './registry.js';
import { RouteBuilder } from './builder.js';
import { toHonoPath } from './path-params.js';
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
import { BASE_MAINNET_NETWORK } from './constants.js';
import {
  RouterConfigError,
  formatRouterConfigIssues,
  getRouterConfigIssues,
  routerConfigFromEnv,
  type CreateRouterFromEnvOptions,
} from './config/index.js';
import { initX402 } from './init/x402.js';
import { initMpp } from './init/mpp.js';

interface MonitorEntry {
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
  wellKnown(): (request: Request) => Promise<Response>;
  openapi(): (request: Request) => Promise<Response>;
  llmsTxt(): (request: Request) => Promise<Response>;
  monitors(): MonitorEntry[];
  registry: RouteRegistry;
  /** Standard fetch handler serving all registered routes plus discovery (`/.well-known/x402`, `/openapi.json`, `/llms.txt`). Unmatched requests get a 404 JSON envelope. */
  fetch(request: Request): Promise<Response>;
  /** The internal Hono app, for mounting into a larger app: `app.route('/', router.hono())`. */
  hono(): Hono;
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
  const network = config.network ?? BASE_MAINNET_NETWORK;
  const x402Accepts = getConfiguredX402Accepts(config);
  const configIssues = getRouterConfigIssues(config, { env: process.env });
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
    throw new RouterConfigError(protocolConfigIssues);
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

  const deps: RouterDeps = {
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
    mppSessionConfig:
      config.mpp?.session && config.mpp.operatorKey
        ? { depositMultiplier: config.mpp.session.depositMultiplier ?? 10 }
        : null,
  };

  deps.initPromise = (async () => {
    const x402Result = await initX402(config, kvStore, x402ConfigError);
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

  // Internal Hono app: serves all registered routes under `/{basePath}/{path}`
  // plus the discovery surfaces. Route handlers are bound via registry lookup
  // at request time (not the handler closure) so re-registration of the same
  // key+method (last write wins) dispatches to the newest handler.
  const basePath = (config.basePath ?? 'api').replace(/^\/+|\/+$/g, '');
  const prefix = basePath ? `/${basePath}` : '';
  const app = new Hono();
  const wellKnownHandler = createWellKnownHandler(
    registry,
    resolvedBaseUrl,
    pricesKeys,
    config.discovery,
  );
  const openapiHandler = createOpenAPIHandler(
    registry,
    resolvedBaseUrl,
    pricesKeys,
    config.discovery,
  );
  const llmsTxtHandler = createLlmsTxtHandler(config.discovery);
  app.get('/.well-known/x402', (c) => wellKnownHandler(c.req.raw));
  app.get('/openapi.json', (c) => openapiHandler(c.req.raw));
  app.get('/llms.txt', (c) => llmsTxtHandler(c.req.raw));
  if (prefix) {
    // Also serve discovery under the basePath so a Next.js catch-all route
    // (`app/api/[[...route]]/route.ts`) can reach it via a middleware rewrite.
    app.get(`${prefix}/.well-known/x402`, (c) => wellKnownHandler(c.req.raw));
    app.get(`${prefix}/openapi.json`, (c) => openapiHandler(c.req.raw));
    app.get(`${prefix}/llms.txt`, (c) => llmsTxtHandler(c.req.raw));
  }
  app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404));

  registry.onFirstRegister = (entry) => {
    const template = entry.path ?? entry.key;
    app.on(entry.method, `${prefix}/${toHonoPath(template)}`, (c) =>
      registry.dispatch(entry.key, entry.method)(c.req.raw),
    );
  };

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
      let builder = new RouteBuilder(key, registry, deps, {
        protocols: config.protocols,
      });
      builder = builder.path(normalizedPath);
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

    fetch(request: Request): Promise<Response> {
      return Promise.resolve(app.fetch(request));
    },

    hono(): Hono {
      return app;
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

/**
 * Build a {@link ServiceRouter} from environment variables.
 *
 * Validates every required env var up front and throws a single
 * {@link RouterConfigError} containing all problems at once. Most consumers
 * should use this entry point. Use {@link createRouter} when you need to
 * construct a {@link RouterConfig} programmatically.
 *
 * The env vars this function reads are the canonical schema in
 * `src/config/schema.ts` (`ENV_SPEC`).
 *
 * @example
 * ```ts
 * export const router = createRouterFromEnv({
 *   title: 'My API',
 *   description: 'Pay-per-call search.',
 *   guidance: 'POST /search with { q: string }. Returns top 10 results.',
 * });
 * ```
 */
export function createRouterFromEnv<const P extends Record<string, string> = Record<never, string>>(
  options: CreateRouterFromEnvOptions<P>,
): ServiceRouter<Extract<keyof P, string>> {
  return createRouter<P>(routerConfigFromEnv(options));
}

export { HttpError } from './types.js';
export {
  BASE_MAINNET_NETWORK,
  SOLANA_MAINNET_NETWORK,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  TEMPO_USDC_ADDRESS,
  TEMPO_USDC_DECIMALS,
  DEFAULT_SOLANA_FACILITATOR_URL,
  DEFAULT_TEMPO_RPC_URL,
  ZERO_EVM_ADDRESS,
} from './constants.js';
export type {
  HandlerContext,
  RouterConfig,
  DiscoveryConfig,
  PaidOptions,
  ProtocolType,
  SettlementLifecycleContext,
  SettlementSettledContext,
  SettlementErrorContext,
  X402FacilitatorsConfig,
} from './types.js';
export type { RouterPlugin } from './plugin/index.js';
export type { KvStore } from './kv-store/index.js';
export { routerConfigFromEnv } from './config/index.js';
export type { CreateRouterFromEnvOptions } from './config/index.js';
export { RouterConfigError } from './config/error.js';
export type {
  RouterConfigIssue,
  RouterConfigIssueCode,
  RouterConfigIssueSeverity,
} from './config/types.js';
