import type { DiscoveryConfig, ProtocolType, X402FacilitatorsConfig } from '../types.js';
import type { RouterPlugin } from '../plugin/index.js';
import type { KvStore } from '../kv-store/index.js';

export type RouterConfigIssueCode =
  | 'missing_base_url'
  | 'invalid_base_url'
  | 'empty_protocols'
  | 'missing_x402_accepts'
  | 'missing_x402_network'
  | 'unsupported_x402_network'
  | 'missing_x402_asset'
  | 'invalid_x402_decimals'
  | 'missing_x402_payee'
  | 'invalid_x402_payee'
  | 'invalid_solana_payee'
  | 'invalid_solana_facilitator_url'
  | 'missing_cdp_keys'
  | 'placeholder_payee'
  | 'missing_mpp_config'
  | 'missing_mpp_secret_key'
  | 'missing_mpp_currency'
  | 'invalid_mpp_currency'
  | 'missing_mpp_recipient'
  | 'invalid_mpp_recipient'
  | 'invalid_mpp_rpc_url'
  | 'invalid_mpp_fee_payer_key'
  | 'invalid_mpp_operator_key'
  | 'mpp_operator_equals_fee_payer'
  | 'mpp_operator_recipient_mismatch'
  | 'missing_discovery_title'
  | 'missing_discovery_description'
  | 'missing_discovery_guidance'
  | 'invalid_builder_code'
  | 'invalid_discovery_service_name'
  | 'invalid_discovery_tags'
  | 'invalid_discovery_icon_url'
  | 'invalid_server_url'
  | 'kv_url_without_token'
  | 'kv_token_without_url'
  | 'invalid_kv_url'
  | 'missing_kv_in_production';

export type RouterConfigIssueSeverity = 'error' | 'warning';

export interface RouterConfigIssue {
  code: RouterConfigIssueCode;
  message: string;
  protocol?: ProtocolType;
  /** @default 'error' — warnings are surfaced via `console.warn` and do not throw. */
  severity?: RouterConfigIssueSeverity;
}

/** Internal — every zod issue our schema emits carries these params. */
export interface IssueParams {
  code: RouterConfigIssueCode;
  protocol?: ProtocolType;
  severity?: RouterConfigIssueSeverity;
}

/** Internal — options for `validateRouterConfig` / `getRouterConfigIssues`. */
export interface ValidateOptions {
  env?: Record<string, string | undefined>;
}

/** Options for {@link createRouterFromEnv} / {@link routerConfigFromEnv}. */
export interface CreateRouterFromEnvOptions<
  TPrices extends Record<string, string> = Record<never, string>,
> {
  /** Defaults to `process.env`. Pass an explicit object in tests. */
  env?: Record<string, string | undefined>;

  /** Discovery title. Shown in `/openapi.json` and `/llms.txt`. */
  title: string;
  /** Discovery description. */
  description: string;
  /** Long-form usage guidance for agent consumers. Served at `/llms.txt`. Pass an empty string to opt out. */
  guidance: string;
  /** Discovery version. @default '1.0.0' */
  version?: string;
  /** Optional contact metadata published in discovery. */
  contact?: DiscoveryConfig['contact'];
  /** Optional ownership proofs published in `/openapi.json` (and the deprecated `/.well-known/x402`). */
  ownershipProofs?: string[];
  /** Per-route HTTP method hint visibility. */
  methodHints?: DiscoveryConfig['methodHints'];
  /** Override the OpenAPI `servers[].url`. Defaults to `BASE_URL`. */
  serverUrl?: string;
  /** Bazaar catalog display name on x402 challenges (≤32 printable-ASCII chars). Defaults to `title` when the title fits. */
  serviceName?: string;
  /** Bazaar catalog tags on x402 challenges (≤5 entries, each ≤32 printable-ASCII chars). */
  tags?: string[];
  /** Bazaar catalog icon on x402 challenges (HTTPS URL, ≤2048 chars). */
  iconUrl?: string;

  /**
   * Centralized price map keyed by route id. `route(key)` auto-applies
   * `.paid(prices[key])` for matching keys.
   *
   * @deprecated Price routes inline with `.paid()` and list route keys in
   * `expectRoutes` to keep the barrel-completeness validation. Will be removed
   * in the next major.
   */
  prices?: TPrices;
  /** Observability plugin. */
  plugin?: RouterPlugin;
  /** Custom KV store. When omitted, the router auto-bootstraps from `KV_REST_API_URL` + `KV_REST_API_TOKEN`. */
  kvStore?: KvStore;
  /** Override x402 facilitators. The Solana facilitator defaults to `SOLANA_FACILITATOR_URL` env or `DEFAULT_SOLANA_FACILITATOR_URL`. */
  x402Facilitators?: X402FacilitatorsConfig;
  /** Route keys that must be registered before discovery output is served — catches missing barrel imports. See {@link DiscoveryConfig.expectRoutes}. */
  expectRoutes?: readonly string[];
  /** Explicit protocol list. Default: `['x402']`, with `'mpp'` added when `MPP_SECRET_KEY` is set. */
  protocols?: readonly ProtocolType[];
  /** Require `route({ path })` form for every route. @default false */
  strictRoutes?: boolean;
}
