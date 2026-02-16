import type { AccountingConfig, AccountingSnapshot, RouteAccounting } from './types.js';
import { withCronAuth } from './cron.js';

export class AccountingTracker {
  private readonly costs: AccountingConfig['costs'];
  private readonly onFlush?: (snapshot: AccountingSnapshot) => Promise<void>;
  private readonly data = new Map<
    string,
    { calls: number; revenue: number; cost: number; upstream: string }
  >();

  constructor(config: AccountingConfig) {
    this.costs = config.costs;
    this.onFlush = config.onFlush;
  }

  record(route: string, revenue: number): void {
    const costConfig = this.costs[route];
    const cost = costConfig?.costPerCall ?? 0;
    const upstream = costConfig?.upstream ?? 'unknown';

    const existing = this.data.get(route);
    if (existing) {
      existing.calls += 1;
      existing.revenue += revenue;
      existing.cost += cost;
    } else {
      this.data.set(route, { calls: 1, revenue, cost, upstream });
    }
  }

  snapshot(): AccountingSnapshot {
    let totalRevenue = 0;
    let totalCost = 0;
    const byRoute: Record<string, RouteAccounting> = {};

    for (const [route, data] of this.data) {
      totalRevenue += data.revenue;
      totalCost += data.cost;
      byRoute[route] = {
        calls: data.calls,
        revenue: data.revenue,
        cost: data.cost,
        margin: data.revenue - data.cost,
        upstream: data.upstream,
      };
    }

    return {
      revenue: totalRevenue,
      cost: totalCost,
      margin: totalRevenue - totalCost,
      byRoute,
    };
  }

  async flush(): Promise<void> {
    if (this.onFlush) {
      await this.onFlush(this.snapshot());
    }
  }
}

export function createAccountingHandler(
  tracker: AccountingTracker,
): (request: Request) => Promise<Response> {
  return withCronAuth(async () => {
    const snapshot = tracker.snapshot();
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}
