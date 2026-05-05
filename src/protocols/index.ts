import type { PaymentStrategy } from './types.js';
import { mppStrategy } from './mpp/strategy.js';
import { x402Strategy } from './x402/strategy.js';

export type { PaymentStrategy } from './types.js';
export { detectProtocol } from './detect.js';

const STRATEGIES: Record<'x402' | 'mpp', PaymentStrategy> = {
  x402: x402Strategy,
  mpp: mppStrategy,
};

/** Get the strategy for a named protocol. */
export function getPaymentStrategy(protocol: 'x402' | 'mpp'): PaymentStrategy {
  return STRATEGIES[protocol];
}

/** Find the strategy whose `detects()` matches this request, restricted to allowed protocols. */
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

/** All strategies allowed by the route, in iteration order. */
export function getAllowedStrategies(allowed: readonly ('x402' | 'mpp')[]): PaymentStrategy[] {
  return allowed.map((name) => STRATEGIES[name]);
}
