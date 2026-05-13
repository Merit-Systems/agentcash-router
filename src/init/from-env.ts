import type {
  DiscoveryConfig,
  ProtocolType,
  RouterConfig,
  X402AcceptConfig,
  X402FacilitatorsConfig,
} from '../types.js';
import type { RouterPlugin } from '../plugin/index.js';
import type { KvStore } from '../kv-store/index.js';
import {
  BASE_MAINNET_NETWORK,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  DEFAULT_SOLANA_FACILITATOR_URL,
  SOLANA_MAINNET_NETWORK,
} from '../constants.js';
import { RouterConfigError } from '../config/error.js';
import type { RouterConfigIssue } from '../config/types.js';
import { isEvmAddress, isEvmPrivateKey } from '../config/validators/shared.js';

/**
 * Discovery copy + non-env overrides for {@link createRouterFromEnv} /
 * {@link routerConfigFromEnv}.
 *
 * Payment and infrastructure settings come from environment variables —
 * see {@link createRouterFromEnv} for the full list of recognised env vars.
 */
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
  /** Override x402 facilitators. The Solana facilitator defaults to `SOLANA_FACILITATOR_URL` env or {@link DEFAULT_SOLANA_FACILITATOR_URL}. */
  x402Facilitators?: X402FacilitatorsConfig;
  /** Explicit protocol list. Default: `['x402']`, with `'mpp'` added when `MPP_SECRET_KEY` is set. */
  protocols?: readonly ProtocolType[];
  /** Require `route({ path })` form for every route. @default false */
  strictRoutes?: boolean;
}

/**
 * Build a {@link RouterConfig} from environment variables.
 *
 * Validates every required value up front and throws a single
 * {@link RouterConfigError} containing all issues at once.
 *
 * Use this when you need the config before constructing the router.
 * Most consumers should call {@link createRouterFromEnv} instead.
 */
export function routerConfigFromEnv<
  const TPrices extends Record<string, string> = Record<never, string>,
>(options: CreateRouterFromEnvOptions<TPrices>): RouterConfig & { prices?: TPrices } {
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const issues: RouterConfigIssue[] = [];

  const baseUrl = trim(env.BASE_URL);
  if (!baseUrl) {
    issues.push({
      code: 'missing_base_url',
      message:
        'BASE_URL is required. Set it to your production origin (e.g. "https://api.example.com"). The realm is used for payment matching and must match the public domain.',
    });
  } else if (!isUrl(baseUrl)) {
    issues.push({
      code: 'invalid_base_url',
      message: `BASE_URL must be a valid URL. Got: ${baseUrl}`,
    });
  }

  const rawPayee = trim(env.X402_WALLET_ADDRESS);
  let payeeAddress = '';
  if (!rawPayee) {
    issues.push({
      code: 'missing_x402_payee',
      protocol: 'x402',
      message: 'X402_WALLET_ADDRESS is required — the EVM address that receives x402 payments.',
    });
  } else if (!isEvmAddress(rawPayee)) {
    issues.push({
      code: 'invalid_x402_payee',
      protocol: 'x402',
      message: 'X402_WALLET_ADDRESS must be a 0x-prefixed 20-byte EVM address.',
    });
  } else {
    payeeAddress = canonicalizeEvmAddress(rawPayee);
  }

  const solanaPayee = trim(env.SOLANA_PAYEE_ADDRESS);
  if (solanaPayee && !isSolanaAddress(solanaPayee)) {
    issues.push({
      code: 'invalid_solana_payee',
      protocol: 'x402',
      message: 'SOLANA_PAYEE_ADDRESS must be a base58 Solana address (32–44 chars).',
    });
  }

  const configuredSolanaFacilitator = options.x402Facilitators?.solana;
  const solanaFacilitator =
    typeof configuredSolanaFacilitator === 'string'
      ? configuredSolanaFacilitator
      : (configuredSolanaFacilitator ??
        trim(env.SOLANA_FACILITATOR_URL) ??
        DEFAULT_SOLANA_FACILITATOR_URL);
  if (typeof solanaFacilitator === 'string' && !isUrl(solanaFacilitator)) {
    issues.push({
      code: 'invalid_solana_facilitator_url',
      protocol: 'x402',
      message: `Solana facilitator must be a valid URL. Got: ${solanaFacilitator}`,
    });
  }

  const mppExplicit = options.protocols?.includes('mpp') ?? false;
  const mppSecretKey = trim(env.MPP_SECRET_KEY);
  const mppEnabled = mppExplicit || !!mppSecretKey;

  const mppCurrency = trim(env.MPP_CURRENCY);
  const mppRpcUrl = trim(env.TEMPO_RPC_URL);
  const mppFeePayerKey = trim(env.MPP_FEE_PAYER_KEY);
  const mppOperatorKey = trim(env.MPP_OPERATOR_KEY);

  if (mppEnabled) {
    if (!mppSecretKey) {
      issues.push({
        code: 'missing_mpp_secret_key',
        protocol: 'mpp',
        message: 'MPP_SECRET_KEY is required when MPP is enabled.',
      });
    }
    if (!mppCurrency) {
      issues.push({
        code: 'missing_mpp_currency',
        protocol: 'mpp',
        message:
          'MPP_CURRENCY is required when MPP is enabled. Use TEMPO_USDC_ADDRESS for Tempo USDC.',
      });
    } else if (!isEvmAddress(mppCurrency)) {
      issues.push({
        code: 'invalid_mpp_currency',
        protocol: 'mpp',
        message: 'MPP_CURRENCY must be a 0x-prefixed 20-byte Tempo currency address.',
      });
    }
    if (!mppRpcUrl) {
      issues.push({
        code: 'missing_mpp_rpc_url',
        protocol: 'mpp',
        message:
          'TEMPO_RPC_URL is required when MPP is enabled. Public `rpc.tempo.xyz` returns 401 — use an authenticated endpoint.',
      });
    } else if (!isUrl(mppRpcUrl)) {
      issues.push({
        code: 'invalid_mpp_rpc_url',
        protocol: 'mpp',
        message: `TEMPO_RPC_URL must be a valid URL. Got: ${mppRpcUrl}`,
      });
    }
    if (mppFeePayerKey && !isEvmPrivateKey(mppFeePayerKey)) {
      issues.push({
        code: 'invalid_mpp_fee_payer_key',
        protocol: 'mpp',
        message: 'MPP_FEE_PAYER_KEY must be a 0x-prefixed 32-byte EVM private key.',
      });
    }
    if (mppOperatorKey && !isEvmPrivateKey(mppOperatorKey)) {
      issues.push({
        code: 'invalid_mpp_operator_key',
        protocol: 'mpp',
        message: 'MPP_OPERATOR_KEY must be a 0x-prefixed 32-byte EVM private key.',
      });
    }
  }

  if (!options.title?.trim()) {
    issues.push({
      code: 'missing_discovery_title',
      message: 'discovery `title` is required. Pass a short product name.',
    });
  }
  if (!options.description?.trim()) {
    issues.push({
      code: 'missing_discovery_description',
      message: 'discovery `description` is required. One sentence is enough.',
    });
  }
  if (options.guidance === undefined) {
    issues.push({
      code: 'missing_discovery_guidance',
      message:
        'discovery `guidance` is required. Provide an empty string to opt out of `/llms.txt`.',
    });
  }

  if (issues.length > 0) throw new RouterConfigError(issues);

  // Always emit both `exact` (static pricing) and `upto` (dynamic pricing) on
  // Base USDC so `.paid('0.01')` and `.paid({ dynamic: true })` both work
  // without further config.
  const accepts: X402AcceptConfig[] = [
    { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: payeeAddress },
    {
      scheme: 'upto',
      network: BASE_MAINNET_NETWORK,
      payTo: payeeAddress,
      asset: BASE_USDC_ADDRESS,
      decimals: BASE_USDC_DECIMALS,
    },
  ];
  if (solanaPayee) {
    accepts.push({ scheme: 'exact', network: SOLANA_MAINNET_NETWORK, payTo: solanaPayee });
  }

  const protocols: ProtocolType[] = options.protocols
    ? [...options.protocols]
    : mppEnabled
      ? ['x402', 'mpp']
      : ['x402'];

  // Session mode is required for streaming + dynamic-priced MPP routes. Enable
  // it whenever an operator key is configured — operator presence is the
  // signal that this deployment wants long-lived channels.
  const mppConfig: RouterConfig['mpp'] | undefined = mppEnabled
    ? {
        secretKey: mppSecretKey!,
        currency: canonicalizeEvmAddress(mppCurrency!),
        rpcUrl: mppRpcUrl!,
        recipient: payeeAddress,
        ...(mppFeePayerKey ? { feePayerKey: mppFeePayerKey } : {}),
        ...(mppOperatorKey ? { operatorKey: mppOperatorKey, session: {} } : {}),
      }
    : undefined;

  return {
    payeeAddress,
    baseUrl: baseUrl!,
    network: BASE_MAINNET_NETWORK,
    protocols,
    x402: {
      accepts,
      facilitators: {
        ...options.x402Facilitators,
        solana: solanaFacilitator,
      },
    },
    ...(mppConfig ? { mpp: mppConfig } : {}),
    discovery: {
      title: options.title,
      version: options.version ?? '1.0.0',
      description: options.description,
      guidance: options.guidance,
      ...(options.contact ? { contact: options.contact } : {}),
      ...(options.ownershipProofs ? { ownershipProofs: options.ownershipProofs } : {}),
      ...(options.methodHints ? { methodHints: options.methodHints } : {}),
      ...(options.serverUrl ? { serverUrl: options.serverUrl } : {}),
    },
    ...(options.prices ? { prices: options.prices } : {}),
    ...(options.plugin ? { plugin: options.plugin } : {}),
    ...(options.kvStore ? { kvStore: options.kvStore } : {}),
    strictRoutes: options.strictRoutes ?? false,
  };
}

function canonicalizeEvmAddress(addr: string): string {
  return addr.toLowerCase();
}

function trim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
