import { describe, expect, it } from 'vitest';
import {
  BASE_MAINNET_NETWORK,
  DEFAULT_SOLANA_FACILITATOR_URL,
  RouterConfigError,
  SOLANA_MAINNET_NETWORK,
  TEMPO_USDC_ADDRESS,
  routerConfigFromEnv,
  type CreateRouterFromEnvOptions,
} from '../src/index.js';
import { BASE_USDC_ADDRESS, BASE_USDC_DECIMALS } from '../src/constants.js';

const PAYEE = '0x1234567890123456789012345678901234567890';
const PAYEE_CHECKSUM = '0x123456789012345678901234567890123456789A';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';
const FEE_PAYER_KEY = `0x${'1'.repeat(64)}`;
const OPERATOR_KEY = `0x${'2'.repeat(64)}`;

const BASE_EXACT_ACCEPT = { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: PAYEE } as const;
const BASE_UPTO_ACCEPT = {
  scheme: 'upto',
  network: BASE_MAINNET_NETWORK,
  payTo: PAYEE,
  asset: BASE_USDC_ADDRESS,
  decimals: BASE_USDC_DECIMALS,
} as const;

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    BASE_URL: 'https://api.example.com',
    X402_WALLET_ADDRESS: PAYEE,
    ...overrides,
  };
}

function validOptions(
  overrides: Partial<CreateRouterFromEnvOptions> = {},
): CreateRouterFromEnvOptions {
  return {
    env: validEnv(),
    title: 'Test API',
    description: 'Pay-per-call test.',
    guidance: 'POST anywhere.',
    ...overrides,
  };
}

describe('routerConfigFromEnv', () => {
  it('builds a minimal x402-only config from required env with exact + upto accepts on Base', () => {
    const config = routerConfigFromEnv(validOptions());

    expect(config.payeeAddress).toBe(PAYEE);
    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.network).toBe(BASE_MAINNET_NETWORK);
    expect(config.protocols).toEqual(['x402']);
    expect(config.x402?.accepts).toEqual([BASE_EXACT_ACCEPT, BASE_UPTO_ACCEPT]);
    expect(config.mpp).toBeUndefined();
  });

  it('canonicalizes checksummed EVM payee to lowercase', () => {
    const config = routerConfigFromEnv(
      validOptions({ env: validEnv({ X402_WALLET_ADDRESS: PAYEE_CHECKSUM }) }),
    );
    expect(config.payeeAddress).toBe(PAYEE_CHECKSUM.toLowerCase());
  });

  it('adds a Solana accept when SOLANA_PAYEE_ADDRESS is set, preserving case', () => {
    const config = routerConfigFromEnv(
      validOptions({ env: validEnv({ SOLANA_PAYEE_ADDRESS: SOLANA_PAYEE }) }),
    );
    expect(config.x402?.accepts).toEqual([
      BASE_EXACT_ACCEPT,
      BASE_UPTO_ACCEPT,
      { scheme: 'exact', network: SOLANA_MAINNET_NETWORK, payTo: SOLANA_PAYEE },
    ]);
  });

  it('defaults the Solana facilitator to DEFAULT_SOLANA_FACILITATOR_URL', () => {
    const config = routerConfigFromEnv(validOptions());
    expect(config.x402?.facilitators?.solana).toBe(DEFAULT_SOLANA_FACILITATOR_URL);
  });

  it('prefers SOLANA_FACILITATOR_URL env over the default', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({ SOLANA_FACILITATOR_URL: 'https://facilitator.example.com' }),
      }),
    );
    expect(config.x402?.facilitators?.solana).toBe('https://facilitator.example.com');
  });

  it('prefers the x402Facilitators option over env and default', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({ SOLANA_FACILITATOR_URL: 'https://from-env.example.com' }),
        x402Facilitators: { solana: 'https://from-option.example.com' },
      }),
    );
    expect(config.x402?.facilitators?.solana).toBe('https://from-option.example.com');
  });

  it('auto-enables MPP when MPP_SECRET_KEY is set and all required MPP env is present', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          MPP_SECRET_KEY: 'secret',
          MPP_CURRENCY: TEMPO_USDC_ADDRESS,
          TEMPO_RPC_URL: 'https://tempo.example.com',
        }),
      }),
    );
    expect(config.protocols).toEqual(['x402', 'mpp']);
    expect(config.mpp).toEqual({
      secretKey: 'secret',
      currency: TEMPO_USDC_ADDRESS,
      rpcUrl: 'https://tempo.example.com',
      recipient: PAYEE,
    });
  });

  it('includes MPP_FEE_PAYER_KEY when provided', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          MPP_SECRET_KEY: 'secret',
          MPP_CURRENCY: TEMPO_USDC_ADDRESS,
          TEMPO_RPC_URL: 'https://tempo.example.com',
          MPP_FEE_PAYER_KEY: FEE_PAYER_KEY,
        }),
      }),
    );
    expect(config.mpp?.feePayerKey).toBe(FEE_PAYER_KEY);
  });

  it('auto-enables session mode when MPP_OPERATOR_KEY is set', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          MPP_SECRET_KEY: 'secret',
          MPP_CURRENCY: TEMPO_USDC_ADDRESS,
          TEMPO_RPC_URL: 'https://tempo.example.com',
          MPP_OPERATOR_KEY: OPERATOR_KEY,
        }),
      }),
    );
    expect(config.mpp?.operatorKey).toBe(OPERATOR_KEY);
    expect(config.mpp?.session).toEqual({});
  });

  it('rejects malformed MPP_OPERATOR_KEY with a structured issue', () => {
    try {
      routerConfigFromEnv(
        validOptions({
          env: validEnv({
            MPP_SECRET_KEY: 'secret',
            MPP_CURRENCY: TEMPO_USDC_ADDRESS,
            TEMPO_RPC_URL: 'https://tempo.example.com',
            MPP_OPERATOR_KEY: 'not-a-private-key',
          }),
        }),
      );
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      expect((error as RouterConfigError).issues.map((i) => i.code)).toContain(
        'invalid_mpp_operator_key',
      );
    }
  });

  it('applies a default version of 1.0.0', () => {
    const config = routerConfigFromEnv(validOptions());
    expect(config.discovery.version).toBe('1.0.0');
  });

  it('forwards explicit prices, plugin, kvStore, and strictRoutes', () => {
    const plugin = { onRequest: () => ({}) } as never;
    const kvStore = {} as never;
    const config = routerConfigFromEnv(
      validOptions({
        prices: { search: '0.01' },
        plugin,
        kvStore,
        strictRoutes: true,
      }),
    );
    expect((config as { prices?: Record<string, string> }).prices).toEqual({ search: '0.01' });
    expect(config.plugin).toBe(plugin);
    expect(config.kvStore).toBe(kvStore);
    expect(config.strictRoutes).toBe(true);
  });

  it('collects every env-validation issue into a single RouterConfigError', () => {
    try {
      routerConfigFromEnv({
        env: {
          BASE_URL: 'not-a-url',
          X402_WALLET_ADDRESS: 'oops',
          SOLANA_PAYEE_ADDRESS: 'not-base58!',
          MPP_SECRET_KEY: 'secret',
          MPP_CURRENCY: 'not-an-address',
          TEMPO_RPC_URL: 'not-a-url',
          MPP_FEE_PAYER_KEY: 'not-a-private-key',
        },
        title: 'Test',
        description: 'Test',
        guidance: '',
      });
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      const codes = (error as RouterConfigError).issues.map((i) => i.code).sort();
      expect(codes).toContain('invalid_base_url');
      expect(codes).toContain('invalid_x402_payee');
      expect(codes).toContain('invalid_solana_payee');
      expect(codes).toContain('invalid_mpp_currency');
      expect(codes).toContain('invalid_mpp_rpc_url');
      expect(codes).toContain('invalid_mpp_fee_payer_key');
    }
  });

  it('rejects missing BASE_URL', () => {
    expect(() =>
      routerConfigFromEnv(validOptions({ env: { X402_WALLET_ADDRESS: PAYEE } })),
    ).toThrow(RouterConfigError);
  });

  it('rejects missing X402_WALLET_ADDRESS', () => {
    expect(() =>
      routerConfigFromEnv(validOptions({ env: { BASE_URL: 'https://api.example.com' } })),
    ).toThrow(RouterConfigError);
  });

  it('rejects partial MPP env (secret without currency / rpc)', () => {
    try {
      routerConfigFromEnv(validOptions({ env: validEnv({ MPP_SECRET_KEY: 'secret' }) }));
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      const codes = (error as RouterConfigError).issues.map((i) => i.code);
      expect(codes).toContain('missing_mpp_currency');
      expect(codes).toContain('missing_mpp_rpc_url');
    }
  });

  it('rejects missing required discovery fields with distinct codes', () => {
    try {
      routerConfigFromEnv({
        env: validEnv(),
        title: '',
        description: '',
        // @ts-expect-error guidance is required
        guidance: undefined,
      });
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      const codes = (error as RouterConfigError).issues.map((i) => i.code).sort();
      expect(codes).toEqual([
        'missing_discovery_description',
        'missing_discovery_guidance',
        'missing_discovery_title',
      ]);
    }
  });
});
