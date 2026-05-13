import type { ChargeFn } from '../types.js';
import { atomicToDecimal, decimalToAtomic } from './format.js';

export function createChargeContext(args: {
  tickCost: string;
  maxPrice: string | undefined;
  route: string;
}) {
  const { tickCost, maxPrice, route } = args;
  const tickAtomic = decimalToAtomic(tickCost);
  if (tickAtomic <= 0n) {
    throw new Error(`route '${route}': tickCost '${tickCost}' must be a positive decimal string`);
  }
  const capAtomic = maxPrice !== undefined ? decimalToAtomic(maxPrice) : null;
  let ticks = 0;
  let atomic = 0n;
  let channelCharge: (() => Promise<void>) | null = null;

  const charge: ChargeFn = async () => {
    const nextAtomic = atomic + tickAtomic;
    if (capAtomic !== null && nextAtomic > capAtomic) {
      throw Object.assign(
        new Error(
          `route '${route}': charge() running total ($${atomicToDecimal(nextAtomic)}) exceeds maxPrice ($${atomicToDecimal(capAtomic)})`,
        ),
        { status: 400, code: 'CHARGE_OVER_CAP' as const },
      );
    }
    ticks += 1;
    atomic = nextAtomic;
    if (channelCharge) await channelCharge();
  };

  return {
    charge,
    bindChannelCharge: (fn: (() => Promise<void>) | null) => {
      channelCharge = fn;
    },
    tickCount: () => ticks,
    atomicTotal: () => atomic,
  };
}

export type ChargeContext = ReturnType<typeof createChargeContext>;
