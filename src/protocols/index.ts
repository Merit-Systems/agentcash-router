import type { ProtocolType } from '../types.js';
import type { PaymentStrategy } from './types.js';
import { mppStrategy } from './mpp/strategy.js';
import { x402Strategy } from './x402/strategy.js';

export type { PaymentStrategy } from './types.js';

const STRATEGIES: Record<ProtocolType, PaymentStrategy> = {
  x402: x402Strategy,
  mpp: mppStrategy,
};

export function selectIncomingStrategy(
  request: Request,
  allowed: readonly ProtocolType[],
): PaymentStrategy | null {
  for (const name of allowed) {
    const strategy = STRATEGIES[name];
    if (strategy.detects(request)) return strategy;
  }
  return null;
}

export function getAllowedStrategies(allowed: readonly ProtocolType[]): PaymentStrategy[] {
  return allowed.map((name) => STRATEGIES[name]);
}
