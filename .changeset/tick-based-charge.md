---
'@agentcash/router': minor
---

Tick-based handler-driven dynamic pricing.

`charge` is now a no-arg event: `() => Promise<void>`. One call = one tick =
`tickCost` USDC = one route-defined unit. Routes set `tickCost`/`unitType`
per-route via `PaidOptions` (falls back to `RouterConfig.mpp.session`
defaults). To bill N units, call `charge()` N times.

This unifies the handler API across protocols: x402 `upto` settles the
cumulative atomic amount (`tickCost * call_count`), and MPP sessions debit
the channel one voucher tick per `charge()` call. Streaming handlers (`async
function*`) drop mppx's auto-charge-per-yield in favor of bridging the
handler's `charge()` directly to the session's `SessionController.charge`, so
the handler is the single source of truth for billing — yields without a
preceding `charge()` ship free.

**Breaking change** for any route using `.paid({ dynamic: true })`. Migrate:

```diff
- .paid({ dynamic: true, maxPrice: '0.10' })
+ .paid({ dynamic: true, tickCost: '0.0005', unitType: 'token', maxPrice: '0.10' })
  .handler(async ({ body, charge }) => {
    const tokens = computeTokens(body);
-   await charge((tokens * 0.0005).toFixed(6));
+   for (let i = 0; i < tokens; i++) await charge();
  });
```
