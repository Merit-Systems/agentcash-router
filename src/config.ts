import type { PaidOptions, ProtocolType, RouterConfig, X402AcceptConfig } from './types.js';
import { BASE_NETWORK, SOLANA_MAINNET_NETWORK } from './constants.js';
import { isEvmNetwork } from './protocols/x402/evm.js';
import { isSolanaNetwork } from './protocols/x402/solana.js';
import { getConfiguredX402Accepts, getConfiguredX402Networks } from './protocols/x402/accepts.js';

export type RouterEnv = Record<string, string | undefined>;

export type RouterConfigIssueCode =
  | 'missing_base_url'
  | 'empty_protocols'
  | 'missing_x402_accepts'
  | 'missing_x402_network'
  | 'unsupported_x402_network'
  | 'missing_x402_asset'
  | 'invalid_x402_decimals'
  | 'missing_x402_payee'
  | 'missing_cdp_keys'
  | 'placeholder_payee'
  | 'missing_mpp_config'
  | 'missing_mpp_secret_key'
  | 'missing_mpp_currency'
  | 'invalid_mpp_currency'
  | 'missing_mpp_recipient'
  | 'invalid_mpp_recipient'
  | 'missing_mpp_rpc_url'
  | 'invalid_mpp_fee_payer_key'
  | 'missing_mpp_default_store_env';

export interface RouterConfigIssue {
  code: RouterConfigIssueCode;
  message: string;
  protocol?: ProtocolType;
}

export interface RouterConfigValidationOptions {
  env?: RouterEnv;
  requireCdpKeys?: boolean;
}

export class RouterConfigError extends Error {
  readonly issues: RouterConfigIssue[];

  constructor(issues: RouterConfigIssue[]) {
    super(formatRouterConfigIssues(issues));
    this.name = 'RouterConfigError';
    this.issues = issues;
  }
}

export function validateRouterConfig(
  config: RouterConfig,
  options: RouterConfigValidationOptions = {},
): void {
  const issues = getRouterConfigIssues(config, options);
  if (issues.length > 0) throw new RouterConfigError(issues);
}

export function getRouterConfigIssues(
  config: RouterConfig,
  options: RouterConfigValidationOptions = {},
): RouterConfigIssue[] {
  const env = options.env ?? process.env;
  const issues: RouterConfigIssue[] = [];
  const protocols = config.protocols ?? ['x402'];

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
    issues.push(...validateX402Config(config, env, options));
  }

  if (protocols.includes('mpp')) {
    issues.push(...validateMppConfig(config, env));
  }

  return issues;
}

export function formatRouterConfigIssues(issues: readonly RouterConfigIssue[]): string {
  return issues.map((issue) => issue.message).join('\n');
}

export function mppFromEnv(
  env: RouterEnv,
  options: {
    recipient?: string;
    require?: boolean;
    useDefaultStore?: boolean;
    feePayerKey?: string;
  } = {},
): RouterConfig['mpp'] | undefined {
  const secretKey = env.MPP_SECRET_KEY;
  const currency = env.MPP_CURRENCY;
  const rpcUrl = env.TEMPO_RPC_URL;
  const feePayerKey = options.feePayerKey ?? env.MPP_FEE_PAYER_KEY;
  const feePayerKeySource = options.feePayerKey !== undefined ? 'feePayerKey' : 'MPP_FEE_PAYER_KEY';
  const hasAnyMppEnv = Boolean(secretKey || currency || rpcUrl || options.require);

  if (!hasAnyMppEnv) return undefined;

  const missing = [
    secretKey ? null : 'MPP_SECRET_KEY',
    currency ? null : 'MPP_CURRENCY',
    rpcUrl ? null : 'TEMPO_RPC_URL',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`MPP env is incomplete. Missing: ${missing.join(', ')}`);
  }

  if (!isEvmAddress(currency!)) {
    throw new Error('MPP_CURRENCY must be a 0x-prefixed 20-byte Tempo currency address');
  }

  if (options.recipient && !isEvmAddress(options.recipient)) {
    throw new Error('MPP recipient must be a 0x-prefixed EVM address');
  }

  if (feePayerKey && !isEvmPrivateKey(feePayerKey)) {
    throw new Error(`${feePayerKeySource} must be a 0x-prefixed 32-byte EVM private key`);
  }

  return {
    secretKey: secretKey!,
    currency: currency!,
    rpcUrl: rpcUrl!,
    ...(options.recipient ? { recipient: options.recipient } : {}),
    ...(feePayerKey ? { feePayerKey } : {}),
    ...(options.useDefaultStore !== undefined ? { useDefaultStore: options.useDefaultStore } : {}),
  };
}

export function x402AcceptsFromEnv(
  env: RouterEnv,
  options: {
    payeeAddress?: string;
    payeeEnv?: string;
    network?: string;
    solanaPayeeAddress?: string;
    solanaPayeeEnv?: string;
  } = {},
): X402AcceptConfig[] {
  const payeeEnv = options.payeeEnv ?? 'X402_WALLET_ADDRESS';
  const solanaPayeeEnv = options.solanaPayeeEnv ?? 'SOLANA_PAYEE_ADDRESS';
  const payeeAddress = options.payeeAddress ?? env[payeeEnv];

  if (!payeeAddress) {
    throw new Error(`${payeeEnv} is required to build x402 accepts`);
  }

  const accepts: X402AcceptConfig[] = [
    {
      scheme: 'exact',
      network: options.network ?? BASE_NETWORK,
      payTo: payeeAddress,
    },
  ];

  const solanaPayeeAddress = options.solanaPayeeAddress ?? env[solanaPayeeEnv];
  if (solanaPayeeAddress) {
    accepts.push({
      scheme: 'exact',
      network: SOLANA_MAINNET_NETWORK,
      payTo: solanaPayeeAddress,
    });
  }

  return accepts;
}

export function paidOptionsForProtocols(protocols: readonly ProtocolType[]): PaidOptions {
  return { protocols: [...protocols] };
}

function validateX402Config(
  config: RouterConfig,
  env: RouterEnv,
  options: RouterConfigValidationOptions,
): RouterConfigIssue[] {
  const issues: RouterConfigIssue[] = [];
  const accepts = getConfiguredX402Accepts(config);

  if (accepts.length === 0) {
    issues.push({
      code: 'missing_x402_accepts',
      protocol: 'x402',
      message: 'x402 requires at least one accept configuration.',
    });
    return issues;
  }

  const acceptWithoutNetwork = accepts.find((accept) => !accept.network);
  if (acceptWithoutNetwork) {
    issues.push({
      code: 'missing_x402_network',
      protocol: 'x402',
      message: 'x402 accepts require a network.',
    });
  }

  const unsupported = accepts.find(
    (accept) => accept.network && !isSupportedX402Network(accept.network),
  );
  if (unsupported) {
    issues.push({
      code: 'unsupported_x402_network',
      protocol: 'x402',
      message: `unsupported x402 network '${unsupported.network}'. Use eip155:* or solana:*.`,
    });
  }

  const missingAsset = accepts.find(
    (accept) => (accept.scheme ?? 'exact') !== 'exact' && !accept.asset,
  );
  if (missingAsset) {
    issues.push({
      code: 'missing_x402_asset',
      protocol: 'x402',
      message: 'non-exact x402 accepts require an asset.',
    });
  }

  const invalidDecimals = accepts.find(
    (accept) =>
      accept.decimals !== undefined && (!Number.isInteger(accept.decimals) || accept.decimals < 0),
  );
  if (invalidDecimals) {
    issues.push({
      code: 'invalid_x402_decimals',
      protocol: 'x402',
      message: 'x402 accept decimals must be a non-negative integer.',
    });
  }

  if (accepts.some((accept) => !accept.payTo) && !config.payeeAddress) {
    issues.push({
      code: 'missing_x402_payee',
      protocol: 'x402',
      message: 'x402 requires payeeAddress in router config or payTo on every x402 accept.',
    });
  }

  const placeholder = findPlaceholderPayee([
    config.payeeAddress,
    ...accepts.map((accept) => (typeof accept.payTo === 'string' ? accept.payTo : undefined)),
  ]);
  if (placeholder) {
    issues.push({
      code: 'placeholder_payee',
      protocol: 'x402',
      message: `x402 payee '${placeholder}' is a placeholder address and cannot receive payments.`,
    });
  }

  if (options.requireCdpKeys !== false && usesDefaultEvmFacilitator(config)) {
    const missing = [
      env.CDP_API_KEY_ID ? null : 'CDP_API_KEY_ID',
      env.CDP_API_KEY_SECRET ? null : 'CDP_API_KEY_SECRET',
    ].filter(Boolean);
    if (missing.length > 0) {
      issues.push({
        code: 'missing_cdp_keys',
        protocol: 'x402',
        message: `default EVM x402 facilitator requires ${missing.join(' and ')}.`,
      });
    }
  }

  return issues;
}

function validateMppConfig(config: RouterConfig, env: RouterEnv): RouterConfigIssue[] {
  const issues: RouterConfigIssue[] = [];
  const mpp = config.mpp;

  if (!mpp) {
    return [
      {
        code: 'missing_mpp_config',
        protocol: 'mpp',
        message:
          'protocols includes "mpp" but mpp config is missing. Add mpp: { secretKey, currency, recipient } to your router config.',
      },
    ];
  }

  if (!mpp.secretKey) {
    issues.push({
      code: 'missing_mpp_secret_key',
      protocol: 'mpp',
      message: 'MPP requires secretKey. Set MPP_SECRET_KEY or pass mpp.secretKey.',
    });
  }

  if (!mpp.currency) {
    issues.push({
      code: 'missing_mpp_currency',
      protocol: 'mpp',
      message: 'MPP requires currency. Set MPP_CURRENCY or pass mpp.currency.',
    });
  } else if (!isEvmAddress(mpp.currency)) {
    issues.push({
      code: 'invalid_mpp_currency',
      protocol: 'mpp',
      message:
        'MPP currency must be a 0x-prefixed 20-byte Tempo currency address. Use TEMPO_USDC_CURRENCY for Tempo USDC.',
    });
  }

  const mppRecipient = mpp.recipient ?? config.payeeAddress;
  if (!mppRecipient) {
    issues.push({
      code: 'missing_mpp_recipient',
      protocol: 'mpp',
      message:
        'MPP requires a recipient address. Set mpp.recipient or payeeAddress in your router config.',
    });
  } else if (!isEvmAddress(mppRecipient)) {
    issues.push({
      code: 'invalid_mpp_recipient',
      protocol: 'mpp',
      message: 'MPP recipient must be a 0x-prefixed EVM address. Solana recipients require x402.',
    });
  }

  const placeholder = findPlaceholderPayee([mpp.recipient, config.payeeAddress]);
  if (placeholder) {
    issues.push({
      code: 'placeholder_payee',
      protocol: 'mpp',
      message: `MPP recipient '${placeholder}' is a placeholder address and cannot receive payments.`,
    });
  }

  if (!(mpp.rpcUrl ?? env.TEMPO_RPC_URL)) {
    issues.push({
      code: 'missing_mpp_rpc_url',
      protocol: 'mpp',
      message:
        'MPP requires an authenticated Tempo RPC URL. Set TEMPO_RPC_URL env var or pass rpcUrl in the mpp config object.',
    });
  }

  if (mpp.feePayerKey && !isEvmPrivateKey(mpp.feePayerKey)) {
    issues.push({
      code: 'invalid_mpp_fee_payer_key',
      protocol: 'mpp',
      message: 'MPP feePayerKey must be a 0x-prefixed 32-byte EVM private key.',
    });
  }

  if (mpp.useDefaultStore && !mpp.store && (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN)) {
    issues.push({
      code: 'missing_mpp_default_store_env',
      protocol: 'mpp',
      message:
        'mpp.useDefaultStore requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables. These are automatically set by Vercel KV.',
    });
  }

  return issues;
}

function usesDefaultEvmFacilitator(config: RouterConfig): boolean {
  return (
    getConfiguredX402Networks(config).some(
      (network) => typeof network === 'string' && isEvmNetwork(network),
    ) && config.x402?.facilitators?.evm === undefined
  );
}

function isSupportedX402Network(network: string): boolean {
  return isEvmNetwork(network) || isSolanaNetwork(network);
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isEvmPrivateKey(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function findPlaceholderPayee(values: readonly (string | undefined)[]): string | null {
  return values.find((value) => value !== undefined && /^0x0{40}$/i.test(value)) ?? null;
}
