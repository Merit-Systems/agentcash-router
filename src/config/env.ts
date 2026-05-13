import type { PaidOptions, ProtocolType, RouterConfig, X402AcceptConfig } from '../types.js';
import { BASE_MAINNET_NETWORK, SOLANA_MAINNET_NETWORK } from '../constants.js';
import type { RouterEnv } from './types.js';
import { isEvmAddress, isEvmPrivateKey } from './validators/shared.js';

export function mppFromEnv(
  env: RouterEnv,
  options: {
    recipient?: string;
    require?: boolean;
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
      network: options.network ?? BASE_MAINNET_NETWORK,
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
