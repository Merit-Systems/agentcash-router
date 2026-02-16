import { describe, it, expect, vi } from 'vitest';
import { AccountingTracker } from '../src/accounting.js';
import type { AccountingConfig } from '../src/types.js';

function makeConfig(onFlush?: AccountingConfig['onFlush']): AccountingConfig {
  return {
    costs: {
      search: { upstream: 'exa', costPerCall: 0.01 },
      enrich: { upstream: 'enrichx', costPerCall: 0.03 },
    },
    onFlush,
  };
}

describe('AccountingTracker', () => {
  it('records and aggregates single route', () => {
    const tracker = new AccountingTracker(makeConfig());
    tracker.record('search', 0.05);
    tracker.record('search', 0.05);

    const snap = tracker.snapshot();
    expect(snap.revenue).toBeCloseTo(0.1);
    expect(snap.cost).toBeCloseTo(0.02);
    expect(snap.margin).toBeCloseTo(0.08);
    expect(snap.byRoute['search']?.calls).toBe(2);
  });

  it('aggregates multiple routes', () => {
    const tracker = new AccountingTracker(makeConfig());
    tracker.record('search', 0.05);
    tracker.record('enrich', 0.1);

    const snap = tracker.snapshot();
    expect(snap.revenue).toBeCloseTo(0.15);
    expect(snap.cost).toBeCloseTo(0.04);
    expect(snap.byRoute['enrich']?.upstream).toBe('enrichx');
  });

  it('handles unknown routes with zero cost', () => {
    const tracker = new AccountingTracker(makeConfig());
    tracker.record('unknown', 0.02);

    const snap = tracker.snapshot();
    expect(snap.byRoute['unknown']?.cost).toBe(0);
    expect(snap.byRoute['unknown']?.upstream).toBe('unknown');
  });

  it('returns empty snapshot when no records', () => {
    const tracker = new AccountingTracker(makeConfig());
    const snap = tracker.snapshot();
    expect(snap.revenue).toBe(0);
    expect(snap.byRoute).toEqual({});
  });

  it('flush calls onFlush with snapshot', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const tracker = new AccountingTracker(makeConfig(onFlush));
    tracker.record('search', 0.05);

    await tracker.flush();
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush.mock.calls[0][0].revenue).toBeCloseTo(0.05);
  });

  it('flush is no-op without onFlush', async () => {
    const tracker = new AccountingTracker(makeConfig());
    await tracker.flush();
  });
});
