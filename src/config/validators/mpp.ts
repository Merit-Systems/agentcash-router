import { privateKeyToAccount } from 'viem/accounts';
import type { RouterConfig } from '../../types.js';
import type { RouterConfigIssue, RouterEnv } from '../types.js';
import { findPlaceholderPayee, isEvmAddress, isEvmPrivateKey } from './shared.js';

type Mpp = NonNullable<RouterConfig['mpp']>;

interface MppCheckArgs {
  config: RouterConfig;
  mpp: Mpp;
  env: RouterEnv;
}

type MppCheck = (args: MppCheckArgs) => RouterConfigIssue | null;

const CHECKS: MppCheck[] = [
  checkSecretKey,
  checkCurrency,
  checkRecipient,
  checkPlaceholderRecipient,
  checkRpcUrl,
  checkFeePayerKey,
  checkOperatorKey,
  checkOperatorMatchesFeePayer,
  checkDefaultStoreEnv,
];

export function validateMppConfig(config: RouterConfig, env: RouterEnv): RouterConfigIssue[] {
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
  const args: MppCheckArgs = { config, mpp, env };
  return CHECKS.map((check) => check(args)).filter(
    (issue): issue is RouterConfigIssue => issue !== null,
  );
}

function checkSecretKey({ mpp }: MppCheckArgs): RouterConfigIssue | null {
  if (mpp.secretKey) return null;
  return {
    code: 'missing_mpp_secret_key',
    protocol: 'mpp',
    message: 'MPP requires secretKey. Set MPP_SECRET_KEY or pass mpp.secretKey.',
  };
}

function checkCurrency({ mpp }: MppCheckArgs): RouterConfigIssue | null {
  if (!mpp.currency) {
    return {
      code: 'missing_mpp_currency',
      protocol: 'mpp',
      message: 'MPP requires currency. Set MPP_CURRENCY or pass mpp.currency.',
    };
  }
  if (!isEvmAddress(mpp.currency)) {
    return {
      code: 'invalid_mpp_currency',
      protocol: 'mpp',
      message:
        'MPP currency must be a 0x-prefixed 20-byte Tempo currency address. Use TEMPO_USDC_CURRENCY for Tempo USDC.',
    };
  }
  return null;
}

function checkRecipient({ config, mpp }: MppCheckArgs): RouterConfigIssue | null {
  const recipient = mpp.recipient ?? config.payeeAddress;
  if (!recipient) {
    return {
      code: 'missing_mpp_recipient',
      protocol: 'mpp',
      message:
        'MPP requires a recipient address. Set mpp.recipient or payeeAddress in your router config.',
    };
  }
  if (!isEvmAddress(recipient)) {
    return {
      code: 'invalid_mpp_recipient',
      protocol: 'mpp',
      message: 'MPP recipient must be a 0x-prefixed EVM address. Solana recipients require x402.',
    };
  }
  return null;
}

function checkPlaceholderRecipient({ config, mpp }: MppCheckArgs): RouterConfigIssue | null {
  const placeholder = findPlaceholderPayee([mpp.recipient, config.payeeAddress]);
  if (!placeholder) return null;
  return {
    code: 'placeholder_payee',
    protocol: 'mpp',
    message: `MPP recipient '${placeholder}' is a placeholder address and cannot receive payments.`,
  };
}

function checkRpcUrl({ mpp, env }: MppCheckArgs): RouterConfigIssue | null {
  if (mpp.rpcUrl ?? env.TEMPO_RPC_URL) return null;
  return {
    code: 'missing_mpp_rpc_url',
    protocol: 'mpp',
    message:
      'MPP requires an authenticated Tempo RPC URL. Set TEMPO_RPC_URL env var or pass rpcUrl in the mpp config object.',
  };
}

function checkFeePayerKey({ mpp }: MppCheckArgs): RouterConfigIssue | null {
  if (!mpp.feePayerKey || isEvmPrivateKey(mpp.feePayerKey)) return null;
  return {
    code: 'invalid_mpp_fee_payer_key',
    protocol: 'mpp',
    message: 'MPP feePayerKey must be a 0x-prefixed 32-byte EVM private key.',
  };
}

function checkOperatorKey({ mpp }: MppCheckArgs): RouterConfigIssue | null {
  if (!mpp.operatorKey || isEvmPrivateKey(mpp.operatorKey)) return null;
  return {
    code: 'invalid_mpp_operator_key',
    protocol: 'mpp',
    message: 'MPP operatorKey must be a 0x-prefixed 32-byte EVM private key.',
  };
}

function checkOperatorMatchesFeePayer({ mpp }: MppCheckArgs): RouterConfigIssue | null {
  if (!mpp.operatorKey || !mpp.feePayerKey) return null;
  if (!isEvmPrivateKey(mpp.operatorKey) || !isEvmPrivateKey(mpp.feePayerKey)) return null;

  const opAddr = privateKeyToAccount(mpp.operatorKey as `0x${string}`).address.toLowerCase();
  const fpAddr = privateKeyToAccount(mpp.feePayerKey as `0x${string}`).address.toLowerCase();
  if (opAddr !== fpAddr) return null;

  return {
    code: 'mpp_operator_equals_fee_payer',
    protocol: 'mpp',
    message:
      `MPP operatorKey and feePayerKey resolve to the same address (${opAddr}). ` +
      `Tempo rejects fee-delegated txs with sender === feePayer, so channel ` +
      `close/settle would fail at runtime. Either use two distinct wallets, ` +
      `or omit feePayerKey to disable gas sponsorship (clients then pay their own gas).`,
  };
}

function checkDefaultStoreEnv({ mpp, env }: MppCheckArgs): RouterConfigIssue | null {
  if (!mpp.useDefaultStore || mpp.store) return null;
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return null;
  return {
    code: 'missing_mpp_default_store_env',
    protocol: 'mpp',
    message:
      'mpp.useDefaultStore requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables. These are automatically set by Vercel KV.',
  };
}
