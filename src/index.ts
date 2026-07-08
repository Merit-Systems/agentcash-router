import { Hono } from 'hono';
import type { RouterConfig } from './types.js';
import type { RouteDefinition, RouteMethod } from './types.js';
import type { RouterDeps } from './pipeline/orchestrate.js';
import { RouteRegistry } from './registry.js';
import { RouteBuilder } from './builder.js';
import { normalizePath, toHonoPath } from './path-params.js';
import {
  MemoryNonceStore,
  MemoryEntitlementStore,
  createKvNonceStore,
  createKvEntitlementStore,
  createAgentIdentityNonceStore,
  resolveKvStore,
} from './kv-store/index.js';
import { createWellKnownHandler } from './discovery/well-known.js';
import { createOpenAPIHandler } from './discovery/openapi.js';
import { createLlmsTxtHandler } from './discovery/llms-txt.js';
import { createNotFoundHandler } from './discovery/not-found.js';
import { getConfiguredX402Accepts } from './protocols/x402/accepts.js';
import { resolveResourceMetadata } from './protocols/x402/resource-metadata.js';
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
    ? RouteBuilder<undefined, undefined, undefined, 'none', false, false, 'exact'>
    : RouteBuilder<undefined, undefined, undefined, 'none', false, false, 'none'>;
  /**
   * @deprecated The `/.well-known/x402` surface is no longer a recommended
   * discovery location. The handler keeps working for legacy x402 clients,
   * but new integrations should mount `.openapi()` (at `/openapi.json`) and
   * `.llmsTxt()` (at `/llms.txt`) instead.
   */
  wellKnown(): (request: Request) => Promise<Response>;
  /** OpenAPI 3.1 discovery document. Mount at `GET /openapi.json`. */
  openapi(): (request: Request) => Promise<Response>;
  /** Plain-text agent guidance. Mount at `GET /llms.txt`. */
  llmsTxt(): (request: Request) => Promise<Response>;
  /** JSON 404 fallback with rediscovery links. Mount in a catch-all route. */
  notFound(): (request: Request) => Promise<Response>;
  monitors(): MonitorEntry[];
  registry: RouteRegistry;
  /**
   * Standard fetch handler serving all registered routes at
   * `/{basePath}/{path}` plus the discovery surfaces (`/.well-known/x402`,
   * `/openapi.json`, `/llms.txt` — at the root and under the basePath).
   * Unmatched requests get the `.notFound()` JSON envelope. This is the entry
   * point for the Next.js catch-all adapter (`@agentcash/router/next`) and any
   * fetch runtime (Bun, Deno, Node ≥18 via `serve`-style adapters).
   */
  fetch(request: Request): Promise<Response>;
  /** The internal Hono app, for mounting into a larger app: `app.route('/', router.hono())`. */
  hono(): Hono;
}

/**
 * Inference is deliberately scoped to the `prices` map. A `const C extends
 * RouterConfig` generic over the whole config captures the entire literal
 * (guidance strings, accepts tuples, plugin closures) in the router's exported
 * type, and every route file that touches the router re-resolves that literal —
 * on large configs that lands at TypeScript's instantiation-depth limit
 * ("Type instantiation is excessively deep"), tripping check-order-dependently
 * in consumer builds. Only the `prices` keys are used at the type level.
 *
 * The `string extends keyof P` guard maps a non-literal `prices` type (a config
 * annotated as plain `RouterConfig`, or a map built at runtime) to `never` so
 * routes stay unpriced at the type level and `.paid()` still typechecks.
 */
type PriceKeysOf<P> = [P] extends [Record<string, string>]
  ? string extends keyof P
    ? never
    : Extract<keyof P, string>
  : never;

export function createRouter<P extends Record<string, string> | undefined = undefined>(
  config: RouterConfig & { prices?: P },
): ServiceRouter<PriceKeysOf<P>> {
  const registry = new RouteRegistry();
  const kvStore = resolveKvStore(config.kvStore);
  const nonceStore = kvStore ? createKvNonceStore(kvStore) : new MemoryNonceStore();
  const agentIdentityNonceStore = createAgentIdentityNonceStore(kvStore);
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
    agentIdentityNonceStore,
    entitlementStore,
    payeeAddress: config.payeeAddress ?? '',
    mppRecipient: config.mpp?.recipient ?? config.payeeAddress,
    network,
    x402FacilitatorsByNetwork: undefined,
    x402Accepts,
    builderCode: config.x402?.builderCode,
    x402ResourceMetadata: resolveResourceMetadata(config.discovery),
    kvStore,
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

  if (config.prices) {
    console.warn(
      '[agentcash/router] RouterConfig.prices is deprecated — price routes inline with .paid() ' +
        '(keep a central const in your service if you want one file of prices). ' +
        'The prices map will be removed in the next major.',
    );
  }

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
    basePath,
  );
  const openapiHandler = createOpenAPIHandler(
    registry,
    resolvedBaseUrl,
    pricesKeys,
    config.discovery,
    basePath,
  );
  const llmsTxtHandler = createLlmsTxtHandler(config.discovery);
  const notFoundHandler = createNotFoundHandler(resolvedBaseUrl);
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
  app.notFound((c) => notFoundHandler(c.req.raw));

  const mountedPaths = new Set<string>();
  registry.onRegister = (entry) => {
    const template = entry.path ?? entry.key;
    const honoPath = `${prefix}/${toHonoPath(template)}`;
    const mountKey = `${entry.method} ${honoPath}`;
    if (mountedPaths.has(mountKey)) return; // path already mounted; dispatch is by key+method
    mountedPaths.add(mountKey);
    app.on(entry.method, honoPath, (c) => registry.dispatch(entry.key, entry.method)(c.req.raw));
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
      return wellKnownHandler;
    },

    openapi() {
      return openapiHandler;
    },

    llmsTxt() {
      return llmsTxtHandler;
    },

    notFound() {
      return notFoundHandler;
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
  } as ServiceRouter<PriceKeysOf<P>>;
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
export function createRouterFromEnv<TPrices extends Record<string, string> = Record<never, string>>(
  options: CreateRouterFromEnvOptions<TPrices>,
): ServiceRouter<PriceKeysOf<TPrices>> {
  return createRouter(routerConfigFromEnv(options)) as unknown as ServiceRouter<
    PriceKeysOf<TPrices>
  >;
}

export { HttpError, RouteDefinitionError, ROUTE_ENTRY } from './types.js';
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
  RouteEntry,
  RegisteredRouteHandler,
  RouterConfig,
  DiscoveryConfig,
  PaidOptions,
  SessionOptions,
  MeteredOptions,
  UpToOptions,
  MppProtocolInfo,
  CheckoutSessionContext,
  CheckoutSessionFn,
  CheckoutSessionResponse,
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
