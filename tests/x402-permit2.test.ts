import { describe, expect, it } from 'vitest';
import { PERMIT2_ADDRESS } from '../src/protocols/x402/strategy.js';

describe('inlined PERMIT2_ADDRESS', () => {
  it('stays equal to the canonical @x402/evm export', async () => {
    // The constant is inlined in strategy.ts to avoid loading @x402/evm at
    // module top-level; this drift test keeps the two in lockstep.
    const evm = (await import('@x402/evm')) as { PERMIT2_ADDRESS: string };
    expect(PERMIT2_ADDRESS).toBe(evm.PERMIT2_ADDRESS);
  });
});
