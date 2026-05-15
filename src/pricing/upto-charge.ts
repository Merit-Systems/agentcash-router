import type { UptoChargeFn } from '../types.js';
import { atomicToDecimal, decimalToAtomic } from './format.js';

export function createUptoChargeContext(args: { maxPrice: string; route: string }) {
  const { maxPrice, route } = args;
  const capAtomic = decimalToAtomic(maxPrice);
  if (capAtomic <= 0n) {
    throw new Error(`route '${route}': maxPrice '${maxPrice}' must be a positive decimal string`);
  }
  let calls = 0;
  let atomic = 0n;

  const charge: UptoChargeFn = async (amount) => {
    const nextAtomic = atomic + decimalToAtomic(amount);
    if (nextAtomic > capAtomic) {
      throw Object.assign(
        new Error(
          `route '${route}': charge() running total ($${atomicToDecimal(nextAtomic)}) exceeds maxPrice ($${atomicToDecimal(capAtomic)})`,
        ),
        { status: 400, code: 'CHARGE_OVER_CAP' as const },
      );
    }
    calls += 1;
    atomic = nextAtomic;
  };

  return {
    charge,
    callCount: () => calls,
    atomicTotal: () => atomic,
  };
}

export type UptoChargeContext = ReturnType<typeof createUptoChargeContext>;
