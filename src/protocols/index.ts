import type { PaymentStrategy } from './types.js';
import { mppStrategy } from './mpp/strategy.js';
import { x402Strategy } from './x402/strategy.js';

export type { PaymentStrategy } from './types.js';
export { detectProtocol } from './detect.js';

const STRATEGIES: Record<'x402' | 'mpp', PaymentStrategy> = {
  x402: x402Strategy,
  mpp: mppStrategy,
};

export function getPaymentStrategy(protocol: 'x402' | 'mpp'): PaymentStrategy {
  return STRATEGIES[protocol];
}

export function selectIncomingStrategy(
  request: Request,
  allowed: readonly ('x402' | 'mpp')[],
): PaymentStrategy | null {
  for (const name of allowed) {
    const strategy = STRATEGIES[name];
    if (strategy.detects(request)) return strategy;
  }
  return null;
}

export function getAllowedStrategies(allowed: readonly ('x402' | 'mpp')[]): PaymentStrategy[] {
  return allowed.map((name) => STRATEGIES[name]);
}
