// =============================================================================
// @agentcash/router config schema — single source of truth
// =============================================================================
// This file is the only place that defines:
//   - The environment variables `routerConfigFromEnv` reads (`envShape`)
//   - The constraints on programmatic `RouterConfig` objects
//   - The mapping from zod issues → public `RouterConfigIssue` codes
//
// If you're adding/renaming an env var or a config constraint, this is the
// file to edit. The README env table and `.env.example` are drift-tested
// against `ENV_KEYS` (see tests/env-drift.test.ts).

import { z } from 'zod';
import type { ProtocolType, RouterConfig, X402AcceptConfig } from '../types.js';
import {
  BASE_MAINNET_NETWORK,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  DEFAULT_SOLANA_FACILITATOR_URL,
  DEFAULT_TEMPO_RPC_URL,
  SOLANA_MAINNET_NETWORK,
} from '../constants.js';
import { getConfiguredX402Accepts } from '../protocols/x402/accepts.js';
import { resolveKvStore } from '../kv-store/index.js';
import { RouterConfigError } from './error.js';
import {
  ENV_DERIVED_CONFIG,
  type CreateRouterFromEnvOptions,
  type IssueParams,
  type RouterConfigIssue,
  type RouterConfigIssueCode,
  type ValidateOptions,
} from './types.js';
import {
  canonicalizeEvm,
  evmAddressFromKey,
  isEvmAddress,
  isEvmPrivateKey,
  isPlaceholderEvm,
  isSolanaAddress,
  isUrl,
  isX402Network,
  operatorAddressesCollide,
  trimAll,
} from './utils.js';

function addIssue(
  ctx: z.RefinementCtx,
  params: IssueParams,
  message: string,
  path: PropertyKey[] = [],
): void {
  ctx.addIssue({ code: 'custom', path, params, message });
}

// -----------------------------------------------------------------------------
// envShape + EnvInputSchema — the canonical env declaration.
// -----------------------------------------------------------------------------
// Field-level refinements own the per-var description + shape check. The
// `superRefine` below owns only missing-required and cross-field rules.
//
// Inputs are pre-trimmed by `trimAll` before reaching zod, so empty strings
// arrive as undefined and `.optional()` semantics match "env var not set".

const x402 = { protocol: 'x402' as const };
const mpp = { protocol: 'mpp' as const };

const envShape = {
  BASE_URL: z
    .string()
    .refine(isUrl, {
      params: { code: 'invalid_base_url' },
      message:
        'BASE_URL must be a valid URL — the public origin used as the 402 realm, OpenAPI server URL, and MPP memo prefix. Must match the public domain.',
    })
    .optional(),

  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),

  EVM_PAYEE_ADDRESS: z
    .string()
    .refine(isEvmAddress, {
      params: { code: 'invalid_x402_payee', ...x402 },
      message:
        'EVM_PAYEE_ADDRESS must be a 0x-prefixed 20-byte EVM address — the wallet that receives x402 and MPP payments.',
    })
    .refine((v) => !isPlaceholderEvm(v), {
      params: { code: 'placeholder_payee', ...x402 },
      message:
        'EVM_PAYEE_ADDRESS is the zero address (0x000…000) — payments to this address are unrecoverable. Set it to a wallet you control.',
    })
    .optional(),

  CDP_API_KEY_ID: z.string().optional(),
  CDP_API_KEY_SECRET: z.string().optional(),

  SOLANA_PAYEE_ADDRESS: z
    .string()
    .refine(isSolanaAddress, {
      params: { code: 'invalid_solana_payee', ...x402 },
      message:
        'SOLANA_PAYEE_ADDRESS must be a base58 Solana address (32–44 chars). When set, the router also accepts Solana payments.',
    })
    .optional(),

  SOLANA_FACILITATOR_URL: z
    .string()
    .refine(isUrl, {
      params: { code: 'invalid_solana_facilitator_url', ...x402 },
      message:
        'SOLANA_FACILITATOR_URL must be a valid URL — override for the Solana x402 facilitator. Defaults to DEFAULT_SOLANA_FACILITATOR_URL.',
    })
    .optional(),

  MPP_SECRET_KEY: z.string().optional(),

  // MPP_CURRENCY — the Tempo currency address MPP charges in (use
  // TEMPO_USDC_ADDRESS for Tempo USDC). Shape is owned by `validateMppConfig`
  // on the produced config; the env path flows through it via `createRouter`.
  MPP_CURRENCY: z.string().optional(),

  TEMPO_RPC_URL: z
    .string()
    .refine(isUrl, {
      params: { code: 'invalid_mpp_rpc_url', ...mpp },
      message:
        'TEMPO_RPC_URL must be a valid URL — the Tempo JSON-RPC endpoint used for MPP on-chain verification. Optional; defaults to the public DEFAULT_TEMPO_RPC_URL.',
    })
    .optional(),

  // MPP_OPERATOR_KEY — signs server-side close/settle; presence enables MPP
  // session mode. Shape + operator/fee-payer collision rules are owned by
  // `validateMppConfig`.
  MPP_OPERATOR_KEY: z.string().optional(),

  // MPP_FEE_PAYER_KEY — sponsors client gas for channel open/topUp. Must
  // resolve to a different address than MPP_OPERATOR_KEY (checked by
  // `validateMppConfig`).
  MPP_FEE_PAYER_KEY: z.string().optional(),

  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  NODE_ENV: z.string().optional(),
};

export const ENV_KEYS = Object.keys(envShape) as ReadonlyArray<keyof typeof envShape>;

// `mppEnabled` reflects the final protocol decision (explicit `protocols`
// option, else MPP_SECRET_KEY presence) so `protocols: ['mpp']` without MPP
// env fails here with structured issues instead of a TypeError later.
function buildEnvInputSchema(opts: { mppEnabled: boolean }) {
  return z
    .object(envShape)
    .passthrough()
    .superRefine((env, ctx) => {
      // Required-missing — fields whose absence is fatal.
      if (env.BASE_URL === undefined) {
        addIssue(
          ctx,
          { code: 'missing_base_url' },
          'BASE_URL is required — the public origin used as the 402 realm, OpenAPI server URL, and MPP memo prefix. Set it to your production domain. On Vercel, the router auto-derives it from VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL.',
          ['BASE_URL'],
        );
      }
      if (env.EVM_PAYEE_ADDRESS === undefined) {
        addIssue(
          ctx,
          { code: 'missing_x402_payee', ...x402 },
          'EVM_PAYEE_ADDRESS is required — the EVM address that receives x402 and MPP payments.',
          ['EVM_PAYEE_ADDRESS'],
        );
      }

      // MPP required-when-enabled.
      if (opts.mppEnabled) {
        if (env.MPP_SECRET_KEY === undefined) {
          addIssue(
            ctx,
            { code: 'missing_mpp_secret_key', ...mpp },
            "MPP_SECRET_KEY is required when protocols include 'mpp' — the HMAC key for signing/verifying MPP challenge nonces.",
            ['MPP_SECRET_KEY'],
          );
        }
        if (env.MPP_CURRENCY === undefined) {
          addIssue(
            ctx,
            { code: 'missing_mpp_currency', ...mpp },
            'MPP_CURRENCY is required when MPP is enabled — the Tempo currency address MPP charges in. Use TEMPO_USDC_ADDRESS for Tempo USDC.',
            ['MPP_CURRENCY'],
          );
        }
        // TEMPO_RPC_URL is optional — defaults to DEFAULT_TEMPO_RPC_URL (the public Tempo endpoint).
      }
    });
}

// -----------------------------------------------------------------------------
// KV warnings — soft, non-throwing. Zod has no warning channel.
// -----------------------------------------------------------------------------

/** Shared by the env path and `createRouter`'s in-memory fallback. */
export const MISSING_KV_IN_PRODUCTION_WARNING =
  'No KV_REST_API_URL/KV_REST_API_TOKEN set in production — using the in-memory KV store. SIWX nonce, SIWX entitlement, and MPP replay state will be lost across instances. Configure Upstash/Vercel KV or pass a custom kvStore.';

function collectKvWarnings(
  env: Record<string, string | undefined>,
  kvStoreOptionProvided: boolean,
): RouterConfigIssue[] {
  if (kvStoreOptionProvided) return [];
  const warn = (code: RouterConfigIssueCode, message: string): RouterConfigIssue => ({
    code,
    message,
  });

  if (env.KV_REST_API_URL && !env.KV_REST_API_TOKEN) {
    return [
      warn(
        'kv_url_without_token',
        'KV_REST_API_URL is set but KV_REST_API_TOKEN is missing — falling back to in-memory KV (unsafe in serverless production).',
      ),
    ];
  }
  if (env.KV_REST_API_TOKEN && !env.KV_REST_API_URL) {
    return [
      warn(
        'kv_token_without_url',
        'KV_REST_API_TOKEN is set but KV_REST_API_URL is missing — falling back to in-memory KV (unsafe in serverless production).',
      ),
    ];
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN && !isUrl(env.KV_REST_API_URL)) {
    return [
      warn(
        'invalid_kv_url',
        `KV_REST_API_URL is not a valid URL — KV calls will fail at request time. Got: ${env.KV_REST_API_URL}`,
      ),
    ];
  }
  if (!env.KV_REST_API_URL && !env.KV_REST_API_TOKEN && env.NODE_ENV === 'production') {
    return [warn('missing_kv_in_production', MISSING_KV_IN_PRODUCTION_WARNING)];
  }
  return [];
}

function withHttps(host: string | undefined): string | undefined {
  if (!host) return undefined;
  return host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
}

function deriveBaseUrlEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (env.BASE_URL) return env;

  const vercelBaseUrl = withHttps(env.VERCEL_PROJECT_PRODUCTION_URL) ?? withHttps(env.VERCEL_URL);
  if (!vercelBaseUrl) return env;

  return {
    ...env,
    BASE_URL: vercelBaseUrl,
  };
}

// -----------------------------------------------------------------------------
// validateRouterConfig — validates programmatic `createRouter(config)` inputs.
// -----------------------------------------------------------------------------
// Hand-written checks (not zod) because RouterConfig is already a structured
// object with opaque slots (plugin, kvStore, payTo functions) that zod can't
// usefully model. Mirrors the env-side cross-field logic.

function missingCdpKeysIssue(env: Record<string, string | undefined>): RouterConfigIssue | null {
  const missing = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'].filter((k) => !env[k]);
  if (missing.length === 0) return null;
  return {
    code: 'missing_cdp_keys',
    protocol: 'x402',
    message:
      `x402 EVM facilitator (Coinbase) requires ${missing.join(' and ')}. ` +
      'Create an API key at https://portal.cdp.coinbase.com and set it via env.',
  };
}

function validateX402Config(
  config: RouterConfig,
  env: Record<string, string | undefined>,
  assumeCdpKeys: boolean,
): RouterConfigIssue[] {
  const accepts = getConfiguredX402Accepts(config);
  const issues: RouterConfigIssue[] = [];
  const push = (code: RouterConfigIssueCode, message: string) =>
    issues.push({ code, protocol: 'x402', message });

  if (accepts.length === 0) {
    push('missing_x402_accepts', 'x402 requires at least one accept configuration.');
    return issues;
  }
  if (accepts.some((a) => !a.network)) {
    push('missing_x402_network', 'x402 accepts require a network.');
  }
  const unsupported = accepts.find((a) => a.network && !isX402Network(a.network));
  if (unsupported) {
    push(
      'unsupported_x402_network',
      `unsupported x402 network '${unsupported.network}'. Use eip155:* or solana:*.`,
    );
  }
  if (accepts.some((a) => (a.scheme ?? 'exact') !== 'exact' && !a.asset)) {
    push('missing_x402_asset', 'non-exact x402 accepts require an asset.');
  }
  if (
    accepts.some(
      (a) => a.decimals !== undefined && (!Number.isInteger(a.decimals) || a.decimals < 0),
    )
  ) {
    push('invalid_x402_decimals', 'x402 accept decimals must be a non-negative integer.');
  }
  if (!config.payeeAddress && accepts.some((a) => !a.payTo)) {
    push(
      'missing_x402_payee',
      'x402 requires payeeAddress in router config or payTo on every x402 accept.',
    );
  }
  const placeholder = [
    config.payeeAddress,
    ...accepts.map((a) => (typeof a.payTo === 'string' ? a.payTo : undefined)),
  ].find((v) => v !== undefined && isPlaceholderEvm(v));
  if (placeholder) {
    push(
      'placeholder_payee',
      `x402 payee '${placeholder}' is a placeholder address and cannot receive payments.`,
    );
  }
  const hasEvm = accepts.some(
    (a) => typeof a.network === 'string' && a.network.startsWith('eip155:'),
  );
  if (hasEvm && !assumeCdpKeys) {
    const cdpIssue = missingCdpKeysIssue(env);
    if (cdpIssue) issues.push(cdpIssue);
  }
  return issues;
}

function validateMppConfig(config: RouterConfig): RouterConfigIssue[] {
  const m = config.mpp;
  if (!m) {
    return [
      {
        code: 'missing_mpp_config',
        protocol: 'mpp',
        message:
          'protocols includes "mpp" but mpp config is missing. Add mpp: { secretKey, currency, recipient } to your router config.',
      },
    ];
  }
  const issues: RouterConfigIssue[] = [];
  const push = (code: RouterConfigIssueCode, message: string) =>
    issues.push({ code, protocol: 'mpp', message });

  if (!m.secretKey) {
    push(
      'missing_mpp_secret_key',
      'MPP requires secretKey. Set MPP_SECRET_KEY or pass mpp.secretKey.',
    );
  }
  if (!m.currency) {
    push('missing_mpp_currency', 'MPP requires currency. Set MPP_CURRENCY or pass mpp.currency.');
  } else if (!isEvmAddress(m.currency)) {
    push(
      'invalid_mpp_currency',
      'MPP currency must be a 0x-prefixed 20-byte Tempo currency address. Use TEMPO_USDC_ADDRESS for Tempo USDC.',
    );
  }
  const recipient = m.recipient ?? config.payeeAddress;
  if (!recipient) {
    push(
      'missing_mpp_recipient',
      'MPP requires a recipient address. Set mpp.recipient or payeeAddress in your router config.',
    );
  } else if (!isEvmAddress(recipient)) {
    push(
      'invalid_mpp_recipient',
      'MPP recipient must be a 0x-prefixed EVM address. Solana recipients require x402.',
    );
  }
  const placeholder = [m.recipient, config.payeeAddress].find(
    (v): v is string => typeof v === 'string' && isPlaceholderEvm(v),
  );
  if (placeholder) {
    push(
      'placeholder_payee',
      `MPP recipient '${placeholder}' is a placeholder address and cannot receive payments.`,
    );
  }
  // rpcUrl is optional — defaults to DEFAULT_TEMPO_RPC_URL when neither mpp.rpcUrl nor TEMPO_RPC_URL is set.
  if (m.feePayerKey && !isEvmPrivateKey(m.feePayerKey)) {
    push(
      'invalid_mpp_fee_payer_key',
      'MPP feePayerKey must be a 0x-prefixed 32-byte EVM private key.',
    );
  }
  if (m.operatorKey && !isEvmPrivateKey(m.operatorKey)) {
    push(
      'invalid_mpp_operator_key',
      'MPP operatorKey must be a 0x-prefixed 32-byte EVM private key.',
    );
  }
  const collision = operatorAddressesCollide(m.operatorKey, m.feePayerKey);
  if (collision) {
    push(
      'mpp_operator_equals_fee_payer',
      `MPP operatorKey and feePayerKey resolve to the same address (${collision}). ` +
        'Tempo rejects fee-delegated txs with sender === feePayer, so channel ' +
        'close/settle would fail at runtime. Either use two distinct wallets, ' +
        'or omit feePayerKey to disable gas sponsorship (clients then pay their own gas).',
    );
  }
  const depositMultiplier = m.session?.depositMultiplier;
  if (
    depositMultiplier !== undefined &&
    (!Number.isInteger(depositMultiplier) || depositMultiplier <= 0)
  ) {
    push(
      'invalid_mpp_deposit_multiplier',
      `mpp.session.depositMultiplier must be a positive integer, got ${depositMultiplier}. ` +
        'It scales tickCost into the suggested channel deposit on the 402 challenge.',
    );
  }
  if (m.session && recipient && isEvmAddress(recipient)) {
    const operatorAddress = evmAddressFromKey(m.operatorKey);
    if (operatorAddress && operatorAddress !== recipient.toLowerCase()) {
      push(
        'mpp_operator_recipient_mismatch',
        `MPP session operatorKey resolves to ${operatorAddress}, which must equal ` +
          `the recipient/payee ${recipient.toLowerCase()}. mppx's channel-close handler ` +
          'asserts sender === payee. Set mpp.operatorKey to the recipient’s private key, ' +
          'or set mpp.recipient/payeeAddress to the operator address.',
      );
    }
  }
  return issues;
}

// -----------------------------------------------------------------------------
// Translator: zod ZodError → RouterConfigIssue[]
// -----------------------------------------------------------------------------
// Every issue our schema emits carries `params.code` (either from the
// field-level refinement or `addIssue` in superRefine), so the translator is
// a pure shape-shift.

function translateZodIssues(error: z.ZodError): RouterConfigIssue[] {
  return error.issues.map((issue): RouterConfigIssue => {
    const params = (issue as { params?: IssueParams }).params;
    if (!params?.code) {
      throw new Error(
        `[router] schema issue missing params.code (path=${issue.path.join('.')}, message=${issue.message}). ` +
          `Every refinement / addIssue call must set params.code.`,
      );
    }
    return {
      code: params.code,
      message: issue.message,
      ...(params.protocol ? { protocol: params.protocol } : {}),
    };
  });
}

// -----------------------------------------------------------------------------
// Public: routerConfigFromEnv
// -----------------------------------------------------------------------------

/**
 * Build a {@link RouterConfig} from environment variables.
 *
 * `envShape` in this file is the single source of truth for env vars; README
 * and `.env.example` are drift-tested against `ENV_KEYS`. Validates every
 * required value up front and throws a single {@link RouterConfigError}
 * containing all issues at once. Soft warnings (e.g. half-configured KV) are
 * emitted via `console.warn`.
 *
 * This function is the single env reader: the KV store is resolved from the
 * same env object and placed on `config.kvStore`, and CDP keys are validated
 * here — `createRouter` does not consult `process.env` for configs built by
 * this function, so an injected `options.env` is honored end to end.
 */
export function routerConfigFromEnv<
  const TPrices extends Record<string, string> = Record<never, string>,
>(options: CreateRouterFromEnvOptions<TPrices>): RouterConfig & { prices?: TPrices } {
  const rawEnv = options.env ?? (process.env as Record<string, string | undefined>);
  const env = deriveBaseUrlEnv(trimAll(rawEnv));

  const mppEnabled = options.protocols?.includes('mpp') ?? Boolean(env.MPP_SECRET_KEY);
  const x402Enabled = options.protocols?.includes('x402') ?? true;
  const protocols: ProtocolType[] = options.protocols
    ? [...options.protocols]
    : mppEnabled
      ? ['x402', 'mpp']
      : ['x402'];

  const optionIssues: RouterConfigIssue[] = [];
  if (!options.title?.trim()) {
    optionIssues.push({
      code: 'missing_discovery_title',
      message: 'discovery `title` is required. Pass a short product name.',
    });
  }
  if (!options.description?.trim()) {
    optionIssues.push({
      code: 'missing_discovery_description',
      message: 'discovery `description` is required. One sentence is enough.',
    });
  }
  if (options.guidance === undefined) {
    optionIssues.push({
      code: 'missing_discovery_guidance',
      message:
        'discovery `guidance` is required. Provide an empty string to opt out of `/llms.txt`.',
    });
  }
  if (options.serverUrl !== undefined && !isUrl(options.serverUrl)) {
    optionIssues.push({
      code: 'invalid_server_url',
      message: `discovery \`serverUrl\` must be a valid URL. Got: ${options.serverUrl}`,
    });
  }

  const parsed = buildEnvInputSchema({ mppEnabled }).safeParse(env);
  const envIssues = parsed.success ? [] : translateZodIssues(parsed.error);

  // CDP keys are validated against this env object (not process.env) — the
  // env path always emits EVM accepts on Base, so x402 implies Coinbase.
  const cdpIssue = x402Enabled ? missingCdpKeysIssue(env) : null;

  const issues = [...envIssues, ...(cdpIssue ? [cdpIssue] : []), ...optionIssues];
  if (issues.length > 0) throw new RouterConfigError(issues);

  // Warnings (soft) — surfaced after errors clear.
  for (const warning of collectKvWarnings(env, options.kvStore !== undefined)) {
    console.warn(`[router] ${warning.message}`);
  }

  // Build the RouterConfig from validated env + options.
  const payeeAddress = canonicalizeEvm(env.EVM_PAYEE_ADDRESS!);

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
  if (env.SOLANA_PAYEE_ADDRESS) {
    accepts.push({
      scheme: 'exact',
      network: SOLANA_MAINNET_NETWORK,
      payTo: env.SOLANA_PAYEE_ADDRESS,
    });
  }

  const configuredSolanaFacilitator = options.x402Facilitators?.solana;
  const solanaFacilitator =
    typeof configuredSolanaFacilitator === 'string'
      ? configuredSolanaFacilitator
      : (configuredSolanaFacilitator ??
        env.SOLANA_FACILITATOR_URL ??
        DEFAULT_SOLANA_FACILITATOR_URL);

  const mppConfig: RouterConfig['mpp'] | undefined = mppEnabled
    ? {
        secretKey: env.MPP_SECRET_KEY!,
        currency: canonicalizeEvm(env.MPP_CURRENCY!),
        rpcUrl: env.TEMPO_RPC_URL ?? DEFAULT_TEMPO_RPC_URL,
        recipient: payeeAddress,
        ...(env.MPP_FEE_PAYER_KEY ? { feePayerKey: env.MPP_FEE_PAYER_KEY } : {}),
        ...(env.MPP_OPERATOR_KEY ? { operatorKey: env.MPP_OPERATOR_KEY, session: {} } : {}),
      }
    : undefined;

  // KV is resolved from this env object too — explicit option wins, then
  // KV_REST_API_URL/KV_REST_API_TOKEN from the same env the rest of the
  // config came from. `createRouter` does not re-read process.env for
  // env-derived configs.
  const kvStore = options.kvStore ?? resolveKvStore(undefined, env);

  const config: RouterConfig & { prices?: TPrices } = {
    payeeAddress,
    baseUrl: env.BASE_URL!,
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
    ...(kvStore ? { kvStore } : {}),
    strictRoutes: options.strictRoutes ?? false,
  };
  // Enumerable so the spread-and-override pattern keeps the marker.
  Object.defineProperty(config, ENV_DERIVED_CONFIG, { value: true, enumerable: true });
  return config;
}

// -----------------------------------------------------------------------------
// Public: validateRouterConfig + getRouterConfigIssues
// -----------------------------------------------------------------------------

export function validateRouterConfig(config: RouterConfig, options: ValidateOptions = {}): void {
  const issues = getRouterConfigIssues(config, options);
  if (issues.length > 0) throw new RouterConfigError(issues);
}

export function getRouterConfigIssues(
  config: RouterConfig,
  options: ValidateOptions = {},
): RouterConfigIssue[] {
  const env = options.env ?? {};
  const protocols = config.protocols ?? ['x402'];
  const issues: RouterConfigIssue[] = [];

  if (!config.baseUrl) {
    issues.push({
      code: 'missing_base_url',
      message:
        '[router] baseUrl is required in RouterConfig. Set it to your production domain (e.g., "https://api.example.com"). The realm is used for payment matching and must be correct.',
    });
  }
  if (config.protocols && config.protocols.length === 0) {
    issues.push({
      code: 'empty_protocols',
      message:
        "RouterConfig.protocols cannot be empty. Omit the field to use default ['x402'] or specify protocols explicitly.",
    });
  }
  if (protocols.includes('x402')) {
    issues.push(...validateX402Config(config, env, options.assumeCdpKeys ?? false));
  }
  if (protocols.includes('mpp')) issues.push(...validateMppConfig(config));
  return issues;
}
