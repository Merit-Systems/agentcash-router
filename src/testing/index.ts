import type { ServiceRouter } from '../index.js';
import type { ConstraintResult } from './constraints.js';
import { checkAllRoutesReturn402, checkSweepInvariant, checkWalletBalance } from './constraints.js';

export interface RouterTestConfig {
  baseUrl: string;
  constraints?: {
    allRoutesReturn402?: boolean;
    sweepInvariant?: boolean;
    walletBalanceAbove?: number;
  };
  balanceFn?: () => Promise<number>;
  treasuryBuffer?: number;
  treasurySweepThreshold?: number;
}

export interface RouterTestSuite {
  runAll(): Promise<ConstraintResult[]>;
  asVitest(): {
    describeName: string;
    tests: Array<{ name: string; fn: () => Promise<void> }>;
  };
}

export function createRouterTests(
  router: ServiceRouter,
  config: RouterTestConfig,
): RouterTestSuite {
  const constraints = config.constraints ?? {};

  async function runAll(): Promise<ConstraintResult[]> {
    const results: ConstraintResult[] = [];
    const routes = [...router.registry.entries()].map(([, entry]) => entry);

    if (constraints.allRoutesReturn402) {
      results.push(...(await checkAllRoutesReturn402(routes, config.baseUrl)));
    }

    if (constraints.sweepInvariant) {
      results.push(
        checkSweepInvariant(config.treasuryBuffer ?? 10, config.treasurySweepThreshold ?? 20),
      );
    }

    if (constraints.walletBalanceAbove !== undefined && config.balanceFn) {
      results.push(await checkWalletBalance(config.balanceFn, constraints.walletBalanceAbove));
    }

    return results;
  }

  function asVitest() {
    const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

    tests.push({
      name: 'all constraints pass',
      fn: async () => {
        const results = await runAll();
        const failures = results.filter((r) => !r.passed);
        if (failures.length > 0) {
          throw new Error(
            `${failures.length} constraint(s) failed:\n` +
              failures.map((f) => `  - ${f.name}: ${f.message}`).join('\n'),
          );
        }
      },
    });

    return { describeName: 'router constraints', tests };
  }

  return { runAll, asVitest };
}

export type { ConstraintResult } from './constraints.js';
export { checkAllRoutesReturn402, checkSweepInvariant, checkWalletBalance } from './constraints.js';
