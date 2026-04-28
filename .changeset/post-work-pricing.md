---
'@agentcash/router': minor
---

Add post-work pricing for variable-amount routes. New `.paid({ variable: true, maxPrice })` shape lets the handler decide the final settled amount via `payment.setAmount(amount)`, capped at `maxPrice`. Wires to x402 `upto` (requires an `upto` accept on a configured network) and to MPP pull mode. Push-mode (hash-payload) MPP credentials on a variable route now return `400` with a clear message pointing the client at pull mode.

```ts
router
  .route('llm/generate')
  .paid({ variable: true, maxPrice: '0.10' })
  .body(GenerateSchema)
  .handler(async ({ body, payment }) => {
    const result = await runModel(body);
    payment.setAmount(result.usdCost); // <= '0.10'; '0' allowed → no charge
    return result;
  });
```

`SettlementEvent.amount` carries the effective settled amount (effective override ?? originally quoted price). SIWX entitlement is no longer granted when the effective settled amount is `0`.
