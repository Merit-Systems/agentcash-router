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
  | 'invalid_mpp_deposit_multiplier'
  | 'missing_discovery_title'
  | 'missing_discovery_description'
  | 'missing_discovery_guidance'
  | 'invalid_server_url'
  | 'kv_url_without_token'
  | 'kv_token_without_url'
  | 'invalid_kv_url'
  | 'missing_kv_in_production';

export interface RouterConfigIssue {
  code: RouterConfigIssueCode;
  message: string;
  protocol?: ProtocolType;
}

/** Internal — every zod issue our schema emits carries these params. */
export interface IssueParams {
  code: RouterConfigIssueCode;
  protocol?: ProtocolType;
}

/** Internal — options for `validateRouterConfig` / `getRouterConfigIssues`. */
export interface ValidateOptions {
  env?: Record<string, string | undefined>;
  /**
   * Skip the CDP_API_KEY_ID/CDP_API_KEY_SECRET presence check. Set for
   * env-derived configs: `routerConfigFromEnv` already validated the keys
   * against its own env, which may not be `process.env`.
   */
  assumeCdpKeys?: boolean;
}

/**
 * @internal Marker property `routerConfigFromEnv` sets on the configs it
 * returns. `createRouter` treats marked configs as fully env-resolved: it
 * skips its own `process.env` fallbacks (CDP key check, KV bootstrap, missing-
 * KV production warning), so an injected `options.env` stays the single env
 * source. Enumerable, so it survives the documented spread-and-override
 * pattern.
 */
export const ENV_DERIVED_CONFIG: unique symbol = Symbol.for('@agentcash/router.env-derived-config');

/** Options for {@link createRouterFromEnv} / {@link routerConfigFromEnv}. */
export interface CreateRouterFromEnvOptions<
  TPrices extends Record<string, string> = Record<never, string>,
> {
  /** Defaults to `process.env`. Pass an explicit object in tests. */
  env?: Record<string, string | undefined>;

  /** Discovery title. Shown in `.well-known/agentcash`, OpenAPI, and `/llms.txt`. */
  title: string;
  /** Discovery description. */
  description: string;
  /** Long-form usage guidance for agent consumers. Served at `/llms.txt`. Pass an empty string to opt out. */
  guidance: string;
  /** Discovery version. @default '1.0.0' */
  version?: string;
  /** Optional contact metadata published in discovery. */
  contact?: DiscoveryConfig['contact'];
  /** Optional ownership proofs published in `.well-known/agentcash`. */
  ownershipProofs?: string[];
  /** Per-route HTTP method hint visibility. */
  methodHints?: DiscoveryConfig['methodHints'];
  /** Override the OpenAPI `servers[].url`. Defaults to `BASE_URL`. */
  serverUrl?: string;

  /** Centralized price map keyed by route id. `route(key)` auto-applies `.paid(prices[key])` for matching keys. */
  prices?: TPrices;
  /** Observability plugin. */
  plugin?: RouterPlugin;
  /** Custom KV store. When omitted, the router auto-bootstraps from `KV_REST_API_URL` + `KV_REST_API_TOKEN`. */
  kvStore?: KvStore;
  /** Override x402 facilitators. The Solana facilitator defaults to `SOLANA_FACILITATOR_URL` env or `DEFAULT_SOLANA_FACILITATOR_URL`. */
  x402Facilitators?: X402FacilitatorsConfig;
  /** Explicit protocol list. Default: `['x402']`, with `'mpp'` added when `MPP_SECRET_KEY` is set. */
  protocols?: readonly ProtocolType[];
  /** Require `route({ path })` form for every route. @default false */
  strictRoutes?: boolean;
}
