import { describe, expect, it } from 'vitest';
import {
  BASE_MAINNET_NETWORK,
  DEFAULT_SOLANA_FACILITATOR_URL,
  DEFAULT_TEMPO_RPC_URL,
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
    EVM_PAYEE_ADDRESS: PAYEE,
    CDP_API_KEY_ID: 'cdp-id',
    CDP_API_KEY_SECRET: 'cdp-secret',
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

  it('derives BASE_URL from VERCEL_PROJECT_PRODUCTION_URL when BASE_URL is unset', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          BASE_URL: undefined,
          VERCEL_PROJECT_PRODUCTION_URL: 'demo.example.vercel.app',
        }),
      }),
    );

    expect(config.baseUrl).toBe('https://demo.example.vercel.app');
  });

  it('derives BASE_URL from VERCEL_URL when production URL is unavailable', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          BASE_URL: undefined,
          VERCEL_URL: 'demo-git-main.example.vercel.app',
        }),
      }),
    );

    expect(config.baseUrl).toBe('https://demo-git-main.example.vercel.app');
  });

  it('prefers explicit BASE_URL over Vercel system env vars', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          VERCEL_PROJECT_PRODUCTION_URL: 'demo.example.vercel.app',
          VERCEL_URL: 'demo-git-main.example.vercel.app',
        }),
      }),
    );

    expect(config.baseUrl).toBe('https://api.example.com');
  });

  it('canonicalizes checksummed EVM payee to lowercase', () => {
    const config = routerConfigFromEnv(
      validOptions({ env: validEnv({ EVM_PAYEE_ADDRESS: PAYEE_CHECKSUM }) }),
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

  describe('protocol credential inference', () => {
    it('enables MPP only (no x402) when MPP_SECRET_KEY is set without CDP keys', () => {
      const config = routerConfigFromEnv(
        validOptions({
          env: validEnv({
            CDP_API_KEY_ID: undefined,
            CDP_API_KEY_SECRET: undefined,
            MPP_SECRET_KEY: 'secret',
            MPP_CURRENCY: TEMPO_USDC_ADDRESS,
          }),
        }),
      );
      expect(config.protocols).toEqual(['mpp']);
      expect(config.mpp?.secretKey).toBe('secret');
    });

    it('rejects env with neither MPP_SECRET_KEY nor CDP keys', () => {
      try {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({ CDP_API_KEY_ID: undefined, CDP_API_KEY_SECRET: undefined }),
          }),
        );
        expect.fail('routerConfigFromEnv should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterConfigError);
        expect((error as RouterConfigError).issues.map((i) => i.code)).toContain(
          'missing_payment_credentials',
        );
      }
    });

    it('rejects a partial CDP pair, naming the missing key', () => {
      try {
        routerConfigFromEnv(validOptions({ env: validEnv({ CDP_API_KEY_SECRET: undefined }) }));
        expect.fail('routerConfigFromEnv should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterConfigError);
        const issue = (error as RouterConfigError).issues.find(
          (i) => i.code === 'missing_cdp_keys',
        );
        expect(issue?.message).toContain('CDP_API_KEY_SECRET');
        expect(issue?.message).not.toContain('CDP_API_KEY_ID and');
      }
    });

    it('rejects explicit protocols including x402 without CDP keys', () => {
      try {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({ CDP_API_KEY_ID: undefined, CDP_API_KEY_SECRET: undefined }),
            protocols: ['x402'],
          }),
        );
        expect.fail('routerConfigFromEnv should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterConfigError);
        expect((error as RouterConfigError).issues.map((i) => i.code)).toContain(
          'missing_cdp_keys',
        );
      }
    });

    it('warns when SOLANA_PAYEE_ADDRESS is set while x402 is disabled', () => {
      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (msg: unknown) => {
        warnings.push(String(msg));
      };
      try {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({
              CDP_API_KEY_ID: undefined,
              CDP_API_KEY_SECRET: undefined,
              MPP_SECRET_KEY: 'secret',
              MPP_CURRENCY: TEMPO_USDC_ADDRESS,
              SOLANA_PAYEE_ADDRESS: SOLANA_PAYEE,
            }),
          }),
        );
      } finally {
        console.warn = original;
      }
      expect(warnings.some((w) => w.includes('SOLANA_PAYEE_ADDRESS'))).toBe(true);
    });
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
          EVM_PAYEE_ADDRESS: 'oops',
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
    expect(() => routerConfigFromEnv(validOptions({ env: { EVM_PAYEE_ADDRESS: PAYEE } }))).toThrow(
      RouterConfigError,
    );
  });

  it('rejects missing EVM_PAYEE_ADDRESS', () => {
    expect(() =>
      routerConfigFromEnv(validOptions({ env: { BASE_URL: 'https://api.example.com' } })),
    ).toThrow(RouterConfigError);
  });

  it('rejects partial MPP env (secret without currency)', () => {
    try {
      routerConfigFromEnv(validOptions({ env: validEnv({ MPP_SECRET_KEY: 'secret' }) }));
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      const codes = (error as RouterConfigError).issues.map((i) => i.code);
      expect(codes).toContain('missing_mpp_currency');
      // TEMPO_RPC_URL is optional — its absence is no longer an error.
      expect(codes).not.toContain('missing_mpp_rpc_url');
    }
  });

  it('defaults TEMPO_RPC_URL to the public endpoint when unset', () => {
    const config = routerConfigFromEnv(
      validOptions({
        env: validEnv({
          MPP_SECRET_KEY: 'secret',
          MPP_CURRENCY: TEMPO_USDC_ADDRESS,
        }),
      }),
    );
    expect(config.mpp).toEqual({
      secretKey: 'secret',
      currency: TEMPO_USDC_ADDRESS,
      rpcUrl: DEFAULT_TEMPO_RPC_URL,
      recipient: PAYEE,
    });
  });

  it('rejects EVM_PAYEE_ADDRESS set to the zero address', () => {
    try {
      routerConfigFromEnv(
        validOptions({
          env: validEnv({
            EVM_PAYEE_ADDRESS: '0x0000000000000000000000000000000000000000',
          }),
        }),
      );
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      expect((error as RouterConfigError).issues.map((i) => i.code)).toContain('placeholder_payee');
    }
  });

  it('rejects MPP_OPERATOR_KEY and MPP_FEE_PAYER_KEY resolving to the same address', () => {
    const sameKey = `0x${'a'.repeat(64)}`;
    try {
      routerConfigFromEnv(
        validOptions({
          env: validEnv({
            MPP_SECRET_KEY: 'secret',
            MPP_CURRENCY: TEMPO_USDC_ADDRESS,
            TEMPO_RPC_URL: 'https://tempo.example.com',
            MPP_OPERATOR_KEY: sameKey,
            MPP_FEE_PAYER_KEY: sameKey,
          }),
        }),
      );
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      expect((error as RouterConfigError).issues.map((i) => i.code)).toContain(
        'mpp_operator_equals_fee_payer',
      );
    }
  });

  it('rejects a malformed serverUrl option', () => {
    try {
      routerConfigFromEnv(validOptions({ serverUrl: 'not-a-url' }));
      expect.fail('routerConfigFromEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterConfigError);
      expect((error as RouterConfigError).issues.map((i) => i.code)).toContain(
        'invalid_server_url',
      );
    }
  });

  describe('KV warnings', () => {
    function captureWarn(fn: () => void): string[] {
      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (msg: unknown) => {
        warnings.push(String(msg));
      };
      try {
        fn();
      } finally {
        console.warn = original;
      }
      return warnings;
    }

    it('warns when KV_REST_API_URL is set without KV_REST_API_TOKEN', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(
          validOptions({ env: validEnv({ KV_REST_API_URL: 'https://kv.example.com' }) }),
        );
      });
      expect(warnings.some((w) => w.includes('KV_REST_API_TOKEN is missing'))).toBe(true);
    });

    it('warns when KV_REST_API_TOKEN is set without KV_REST_API_URL', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(validOptions({ env: validEnv({ KV_REST_API_TOKEN: 't' }) }));
      });
      expect(warnings.some((w) => w.includes('KV_REST_API_URL is missing'))).toBe(true);
    });

    it('warns when KV_REST_API_URL is malformed', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({ KV_REST_API_URL: 'not-a-url', KV_REST_API_TOKEN: 't' }),
          }),
        );
      });
      expect(warnings.some((w) => w.includes('KV_REST_API_URL is not a valid URL'))).toBe(true);
    });

    it('warns when KV is unset and NODE_ENV=production', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(validOptions({ env: validEnv({ NODE_ENV: 'production' }) }));
      });
      expect(warnings.some((w) => w.includes('in-memory KV store'))).toBe(true);
    });

    it('does not warn when an explicit kvStore option is passed', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({ NODE_ENV: 'production' }),
            kvStore: {} as never,
          }),
        );
      });
      expect(warnings).toEqual([]);
    });

    it('does not warn when KV vars are both set and valid', () => {
      const warnings = captureWarn(() => {
        routerConfigFromEnv(
          validOptions({
            env: validEnv({
              KV_REST_API_URL: 'https://kv.example.com',
              KV_REST_API_TOKEN: 't',
              NODE_ENV: 'production',
            }),
          }),
        );
      });
      expect(warnings).toEqual([]);
    });
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
