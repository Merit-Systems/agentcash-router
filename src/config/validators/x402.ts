import type { RouterConfig } from '../../types.js';
import { getConfiguredX402Accepts } from '../../protocols/x402/accepts.js';
import type { RouterConfigIssue, RouterConfigValidationOptions, RouterEnv } from '../types.js';
import {
  findPlaceholderPayee,
  isSupportedX402Network,
  usesDefaultEvmFacilitator,
} from './shared.js';

type X402Accept = ReturnType<typeof getConfiguredX402Accepts>[number];

interface X402CheckArgs {
  config: RouterConfig;
  accepts: X402Accept[];
  env: RouterEnv;
  options: RouterConfigValidationOptions;
}

type X402Check = (args: X402CheckArgs) => RouterConfigIssue | null;

const CHECKS: X402Check[] = [
  checkAcceptNetworkPresent,
  checkAcceptNetworkSupported,
  checkNonExactRequiresAsset,
  checkDecimalsAreValid,
  checkPayee,
  checkPlaceholderPayeeAddress,
  checkCdpKeys,
];

export function validateX402Config(
  config: RouterConfig,
  env: RouterEnv,
  options: RouterConfigValidationOptions,
): RouterConfigIssue[] {
  const accepts = getConfiguredX402Accepts(config);
  if (accepts.length === 0) {
    return [
      {
        code: 'missing_x402_accepts',
        protocol: 'x402',
        message: 'x402 requires at least one accept configuration.',
      },
    ];
  }
  const args: X402CheckArgs = { config, accepts, env, options };
  return CHECKS.map((check) => check(args)).filter(
    (issue): issue is RouterConfigIssue => issue !== null,
  );
}

function checkAcceptNetworkPresent({ accepts }: X402CheckArgs): RouterConfigIssue | null {
  return accepts.some((accept) => !accept.network)
    ? { code: 'missing_x402_network', protocol: 'x402', message: 'x402 accepts require a network.' }
    : null;
}

function checkAcceptNetworkSupported({ accepts }: X402CheckArgs): RouterConfigIssue | null {
  const unsupported = accepts.find(
    (accept) => accept.network && !isSupportedX402Network(accept.network),
  );
  if (!unsupported) return null;
  return {
    code: 'unsupported_x402_network',
    protocol: 'x402',
    message: `unsupported x402 network '${unsupported.network}'. Use eip155:* or solana:*.`,
  };
}

function checkNonExactRequiresAsset({ accepts }: X402CheckArgs): RouterConfigIssue | null {
  return accepts.some((accept) => (accept.scheme ?? 'exact') !== 'exact' && !accept.asset)
    ? {
        code: 'missing_x402_asset',
        protocol: 'x402',
        message: 'non-exact x402 accepts require an asset.',
      }
    : null;
}

function checkDecimalsAreValid({ accepts }: X402CheckArgs): RouterConfigIssue | null {
  const invalid = accepts.find(
    (accept) =>
      accept.decimals !== undefined && (!Number.isInteger(accept.decimals) || accept.decimals < 0),
  );
  if (!invalid) return null;
  return {
    code: 'invalid_x402_decimals',
    protocol: 'x402',
    message: 'x402 accept decimals must be a non-negative integer.',
  };
}

function checkPayee({ config, accepts }: X402CheckArgs): RouterConfigIssue | null {
  if (config.payeeAddress) return null;
  return accepts.some((accept) => !accept.payTo)
    ? {
        code: 'missing_x402_payee',
        protocol: 'x402',
        message: 'x402 requires payeeAddress in router config or payTo on every x402 accept.',
      }
    : null;
}

function checkPlaceholderPayeeAddress({
  config,
  accepts,
}: X402CheckArgs): RouterConfigIssue | null {
  const placeholder = findPlaceholderPayee([
    config.payeeAddress,
    ...accepts.map((accept) => (typeof accept.payTo === 'string' ? accept.payTo : undefined)),
  ]);
  if (!placeholder) return null;
  return {
    code: 'placeholder_payee',
    protocol: 'x402',
    message: `x402 payee '${placeholder}' is a placeholder address and cannot receive payments.`,
  };
}

function checkCdpKeys({ config, env, options }: X402CheckArgs): RouterConfigIssue | null {
  if (options.requireCdpKeys === false) return null;
  if (!usesDefaultEvmFacilitator(config)) return null;

  const missing = [
    env.CDP_API_KEY_ID ? null : 'CDP_API_KEY_ID',
    env.CDP_API_KEY_SECRET ? null : 'CDP_API_KEY_SECRET',
  ].filter(Boolean);
  if (missing.length === 0) return null;

  return {
    code: 'missing_cdp_keys',
    protocol: 'x402',
    message: `default EVM x402 facilitator requires ${missing.join(' and ')}.`,
  };
}
