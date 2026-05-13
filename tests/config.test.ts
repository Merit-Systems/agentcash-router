import { describe, expect, it } from 'vitest';
import {
  BASE_MAINNET_NETWORK,
  SOLANA_MAINNET_NETWORK,
  TEMPO_USDC_ADDRESS,
} from '../src/constants.js';
import {
  RouterConfigError,
  getRouterConfigIssues,
  validateRouterConfig,
} from '../src/config/index.js';
import type { RouterConfig } from '../src/types.js';

const PAYEE = '0x1234567890123456789012345678901234567890';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';

function makeConfig(overrides: Partial<RouterConfig> = {}): RouterConfig {
  return {
    payeeAddress: PAYEE,
    baseUrl: 'https://api.example.com',
    discovery: {
      title: 'Test API',
      version: '1.0.0',
    },
    ...overrides,
  };
}

describe('router config constants', () => {
  it('exports stable network and currency constants', () => {
    expect(BASE_MAINNET_NETWORK).toBe('eip155:8453');
    expect(SOLANA_MAINNET_NETWORK).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
    expect(TEMPO_USDC_ADDRESS).toBe('0x20c000000000000000000000b9537d11c60e8b50');
  });
});

describe('validateRouterConfig', () => {
  it('throws a structured error for missing CDP keys when EVM x402 is enabled', () => {
    expect(() => validateRouterConfig(makeConfig(), { env: {} })).toThrow(RouterConfigError);

    try {
      validateRouterConfig(makeConfig(), { env: {} });
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      expect((error as RouterConfigError).issues).toEqual([
        {
          code: 'missing_cdp_keys',
          protocol: 'x402',
          message:
            'x402 EVM facilitator (Coinbase) requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.',
        },
      ]);
    }
  });

  it('passes CDP-keys validation when keys are present', () => {
    expect(() =>
      validateRouterConfig(makeConfig(), {
        env: { CDP_API_KEY_ID: 'id', CDP_API_KEY_SECRET: 'secret' },
      }),
    ).not.toThrow();
  });

  it('reports missing MPP secret and currency before async initialization', () => {
    const issues = getRouterConfigIssues(
      makeConfig({
        protocols: ['mpp'],
        mpp: {
          secretKey: '',
          currency: '',
          rpcUrl: 'https://tempo.example.com',
        },
      }),
      { env: {} },
    );

    expect(issues).toEqual([
      {
        code: 'missing_mpp_secret_key',
        protocol: 'mpp',
        message: 'MPP requires secretKey. Set MPP_SECRET_KEY or pass mpp.secretKey.',
      },
      {
        code: 'missing_mpp_currency',
        protocol: 'mpp',
        message: 'MPP requires currency. Set MPP_CURRENCY or pass mpp.currency.',
      },
    ]);
  });

  it('accepts MPP recipient inference from router payeeAddress', () => {
    expect(() =>
      validateRouterConfig(
        makeConfig({
          protocols: ['mpp'],
          mpp: {
            secretKey: 'secret',
            currency: TEMPO_USDC_ADDRESS,
            rpcUrl: 'https://tempo.example.com',
          },
        }),
        { env: {} },
      ),
    ).not.toThrow();
  });

  it('rejects invalid MPP currency and Solana recipients before async initialization', () => {
    const issues = getRouterConfigIssues(
      makeConfig({
        payeeAddress: SOLANA_PAYEE,
        protocols: ['mpp'],
        mpp: {
          secretKey: 'secret',
          currency: 'USDC',
          rpcUrl: 'https://tempo.example.com',
        },
      }),
      { env: {} },
    );

    expect(issues).toEqual([
      {
        code: 'invalid_mpp_currency',
        protocol: 'mpp',
        message:
          'MPP currency must be a 0x-prefixed 20-byte Tempo currency address. Use TEMPO_USDC_ADDRESS for Tempo USDC.',
      },
      {
        code: 'invalid_mpp_recipient',
        protocol: 'mpp',
        message: 'MPP recipient must be a 0x-prefixed EVM address. Solana recipients require x402.',
      },
    ]);
  });

  it('rejects invalid MPP fee payer keys before async initialization', () => {
    const issues = getRouterConfigIssues(
      makeConfig({
        protocols: ['mpp'],
        mpp: {
          secretKey: 'secret',
          currency: TEMPO_USDC_ADDRESS,
          rpcUrl: 'https://tempo.example.com',
          feePayerKey: 'not-a-private-key',
        },
      }),
      { env: {} },
    );

    expect(issues).toEqual([
      {
        code: 'invalid_mpp_fee_payer_key',
        protocol: 'mpp',
        message: 'MPP feePayerKey must be a 0x-prefixed 32-byte EVM private key.',
      },
    ]);
  });

  it('rejects MPP configs where operatorKey and feePayerKey resolve to the same address', () => {
    const SAME_KEY = `0x${'2'.repeat(64)}`;
    const issues = getRouterConfigIssues(
      makeConfig({
        protocols: ['mpp'],
        mpp: {
          secretKey: 'secret',
          currency: TEMPO_USDC_ADDRESS,
          rpcUrl: 'https://tempo.example.com',
          operatorKey: SAME_KEY,
          feePayerKey: SAME_KEY,
        },
      }),
      { env: {} },
    );

    expect(issues).toContainEqual({
      code: 'mpp_operator_equals_fee_payer',
      protocol: 'mpp',
      message: expect.stringContaining(
        'MPP operatorKey and feePayerKey resolve to the same address',
      ),
    });
  });

  it('accepts MPP configs with operatorKey and feePayerKey on distinct addresses', () => {
    const OP_KEY = `0x${'2'.repeat(64)}`;
    const FP_KEY = `0x${'3'.repeat(64)}`;
    const issues = getRouterConfigIssues(
      makeConfig({
        protocols: ['mpp'],
        mpp: {
          secretKey: 'secret',
          currency: TEMPO_USDC_ADDRESS,
          rpcUrl: 'https://tempo.example.com',
          operatorKey: OP_KEY,
          feePayerKey: FP_KEY,
        },
      }),
      { env: {} },
    );

    expect(issues.filter((i) => i.protocol === 'mpp')).toEqual([]);
  });

  it('rejects placeholder payment recipients', () => {
    const issues = getRouterConfigIssues(
      makeConfig({
        payeeAddress: '0x0000000000000000000000000000000000000000',
        protocols: ['x402', 'mpp'],
        mpp: {
          secretKey: 'secret',
          currency: TEMPO_USDC_ADDRESS,
          rpcUrl: 'https://tempo.example.com',
        },
      }),
      {
        env: {
          CDP_API_KEY_ID: 'key',
          CDP_API_KEY_SECRET: 'secret',
        },
      },
    );

    expect(issues.map((issue) => issue.code)).toEqual(['placeholder_payee', 'placeholder_payee']);
  });
});
